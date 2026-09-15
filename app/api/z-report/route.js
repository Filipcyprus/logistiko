import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

// Ζ αναφορά (ημερήσια/μηνιαία) — αφορά ΜΟΝΟ αποδείξεις πραγματικής πώλησης (ταμείο), όχι
// τιμολόγια ούτε αποδείξεις πληρωμής έναντι τιμολογίου (αυτές μετράνε ήδη στο τιμολόγιο).
function computeZData(db, mode, period) {
  const inPeriod = (d) => (mode === "month" ? String(d).slice(0, 7) === period : d === period);

  const receipts = (db.invoices || [])
    .filter((i) => i.type === "apodeixi" && !(i.isPaymentReceipt && i.relatedInvoiceId) && inPeriod(i.date))
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  const sum = (arr, f) => round2(arr.reduce((a, x) => a + Number(f(x) || 0), 0));

  // Ανά συντελεστή ΦΠΑ (από τις γραμμές, ώστε να φαίνεται καθαρά το καθαρό/ΦΠΑ ανά συντελεστή).
  const byVatMap = {};
  for (const r of receipts) {
    for (const it of r.items || []) {
      const rate = Number(it.vatRate || 0);
      const net = Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount || 0) / 100);
      const vat = net * (rate / 100);
      if (!byVatMap[rate]) byVatMap[rate] = { rate, net: 0, vat: 0 };
      byVatMap[rate].net += net;
      byVatMap[rate].vat += vat;
    }
  }
  const byVatRate = Object.values(byVatMap)
    .map((x) => ({ rate: x.rate, net: round2(x.net), vat: round2(x.vat), gross: round2(x.net + x.vat) }))
    .sort((a, b) => b.rate - a.rate);

  // Ανά τρόπο πληρωμής.
  const byMethodMap = {};
  for (const r of receipts) {
    const key = r.paymentMethod || "cash";
    if (!byMethodMap[key]) byMethodMap[key] = { method: key, count: 0, total: 0 };
    byMethodMap[key].count++;
    byMethodMap[key].total += Number(r.total || 0);
  }
  const byPaymentMethod = Object.values(byMethodMap)
    .map((x) => ({ ...x, total: round2(x.total) }))
    .sort((a, b) => b.total - a.total);

  const result = {
    mode, period,
    count: receipts.length,
    net: sum(receipts, (r) => r.net),
    vat: sum(receipts, (r) => r.vat),
    total: sum(receipts, (r) => r.total),
    byVatRate,
    byPaymentMethod,
  };

  if (mode === "day") {
    result.receipts = receipts.map((r) => ({
      id: r.id,
      number: r.number,
      time: r.createdAt,
      customer: r.customer?.name || "",
      paymentMethod: r.paymentMethod || "cash",
      total: r.total,
    }));
  } else {
    // Ανά ημέρα, για το μήνα.
    const byDayMap = {};
    for (const r of receipts) {
      if (!byDayMap[r.date]) byDayMap[r.date] = { date: r.date, count: 0, net: 0, vat: 0, total: 0 };
      byDayMap[r.date].count++;
      byDayMap[r.date].net += Number(r.net || 0);
      byDayMap[r.date].vat += Number(r.vat || 0);
      byDayMap[r.date].total += Number(r.total || 0);
    }
    result.byDay = Object.values(byDayMap)
      .map((x) => ({ ...x, net: round2(x.net), vat: round2(x.vat), total: round2(x.total) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return result;
}

// GET /api/z-report?mode=day&date=YYYY-MM-DD
// GET /api/z-report?mode=month&month=YYYY-MM
// GET /api/z-report?history=true  → λίστα ήδη κλεισμένων Ζ (πιο πρόσφατη πρώτα)
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);

  if (searchParams.get("history") === "true") {
    const list = [...(db.zReports || [])].sort((a, b) => b.number.localeCompare(a.number));
    return NextResponse.json(list);
  }

  const mode = searchParams.get("mode") === "month" ? "month" : "day";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const period = mode === "month" ? month : date;

  // Αν η περίοδος έχει ήδη κλείσει, δείξε τα ΠΑΓΩΜΕΝΑ νούμερα της — ποτέ ξανα-υπολογισμό. Αλλιώς
  // μια μεταγενέστερη διόρθωση/backdated εγγραφή θα άλλαζε αθόρυβα μια ήδη "κλειδωμένη" Ζ.
  const closed = (db.zReports || []).find((z) => z.mode === mode && z.period === period);
  if (closed) {
    return NextResponse.json({ ...closed, closed: true });
  }

  const result = computeZData(db, mode, period);
  return NextResponse.json({ ...result, closed: false });
}

// POST /api/z-report  { mode: "day"|"month", period }  — κλείνει (παγώνει) οριστικά την περίοδο
// με τον επόμενο διαθέσιμο, μοναδικό αριθμό Ζ. Idempotent: αν είναι ήδη κλεισμένη, επιστρέφει
// την υπάρχουσα εγγραφή αντί να δημιουργήσει διπλότυπο.
export async function POST(request) {
  const body = await request.json();
  const mode = body.mode === "month" ? "month" : "day";
  const period = body.period;
  if (!period) return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });

  const db = readDB();
  const existing = (db.zReports || []).find((z) => z.mode === mode && z.period === period);
  if (existing) return NextResponse.json({ ...existing, alreadyClosed: true });

  const data = computeZData(db, mode, period);
  const seq = db.counters.zReport || 1;
  const number = `${db.settings.zReportPrefix || "Z-"}${String(seq).padStart(5, "0")}`;

  const record = {
    id: uid(),
    number,
    ...data,
    closedAt: new Date().toISOString(),
    closedBy: body.closedBy || null,
    auto: !!body.auto,
    printed: false,
  };
  db.zReports = [record, ...(db.zReports || [])];
  db.counters.zReport = seq + 1;
  writeDB(db);
  return NextResponse.json(record, { status: 201 });
}

// PUT /api/z-report  { id, printed: true }  — σημείωσε ότι μια κλεισμένη Ζ τυπώθηκε (δεν αλλάζει
// κανένα ποσό/αριθμό, μόνο αυτή τη σημαία).
export async function PUT(request) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });
  const db = readDB();
  const rec = (db.zReports || []).find((z) => z.id === body.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  rec.printed = !!body.printed;
  writeDB(db);
  return NextResponse.json(rec);
}
