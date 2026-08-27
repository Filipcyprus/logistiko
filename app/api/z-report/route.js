import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Ζ αναφορά (ημερήσια/μηνιαία) — αφορά ΜΟΝΟ αποδείξεις πραγματικής πώλησης (ταμείο), όχι
// τιμολόγια ούτε αποδείξεις πληρωμής έναντι τιμολογίου (αυτές μετράνε ήδη στο τιμολόγιο).
// GET /api/z-report?mode=day&date=YYYY-MM-DD
// GET /api/z-report?mode=month&month=YYYY-MM
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "month" ? "month" : "day";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const period = mode === "month" ? month : date;

  const inPeriod = (d) => (mode === "month" ? String(d).slice(0, 7) === month : d === date);

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

  return NextResponse.json(result);
}
