import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { decrementWarehouseStocks, incrementWarehouseStocks } from "@/lib/stockHelpers";
import { removeEntriesBySource, repostSource } from "@/lib/posting";
import { entryForInvoice } from "@/lib/postingRules";
import { pushActivity } from "@/lib/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function GET(_req, { params }) {
  const db = readDB();
  const rec = db.invoices.find((x) => x.id === params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

// Αλλαγή ημερομηνίας παραστατικού (π.χ. ξεχάστηκε να κοπεί την ίδια μέρα). Μόνο ο owner. Μετακινεί μαζί
// του τη λογιστική εγγραφή και το ιστορικό αποθέματος· δεν αγγίζει ποσά, αριθμό ή πληρωμές.
// Η πραγματική ώρα καταχώρισης μένει στο Ιστορικό Δραστηριότητας.
export async function PUT(request, { params }) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session?.role !== "owner") return NextResponse.json({ error: "errors.dateOnlyOwner" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const date = String(body.date || "");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date + "T00:00:00Z").getTime());
  if (!valid) return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  // Ανοχή μίας ημέρας: ο server τρέχει σε UTC, η Κύπρος είναι 2-3 ώρες μπροστά.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (date > tomorrow) return NextResponse.json({ error: "errors.dateFuture" }, { status: 400 });

  const db = readDB();
  const inv = db.invoices.find((x) => x.id === params.id);
  if (!inv) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  const oldDate = inv.date;
  if (oldDate === date) return NextResponse.json(inv);

  // Κλεισμένη Ζ = παγωμένη περίοδος: ούτε μέσα ούτε έξω από αυτήν δεν μετακινούνται παραστατικά.
  const closedZ = (db.zReports || []).find((z) => [oldDate, date].some((d) => (z.mode === "month" ? String(d).startsWith(z.period) : d === z.period)));
  if (closedZ) return NextResponse.json({ error: "errors.dateZClosed" }, { status: 400 });

  inv.date = date;
  try {
    repostSource(db, "invoice", inv.id, entryForInvoice(db, inv));
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }
  for (const m of db.stockMovements || []) if (m.ref === inv.id) m.date = date;
  pushActivity(db, "invoice_date_changed", { number: inv.number, from: oldDate, to: date }, session);
  writeDB(db);
  return NextResponse.json(inv);
}

// Ακύρωση/διαγραφή παραστατικού — αντιστρέφει την κίνηση αποθέματος.
export async function DELETE(_req, { params }) {
  const db = readDB();
  const inv = db.invoices.find((x) => x.id === params.id);
  if (!inv) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  // Αφαίρεση της λογιστικής εγγραφής — επιτρέπεται μόνο σε ανοιχτή περίοδο. Σε κλειδωμένη, η
  // σωστή κίνηση είναι αντιλογισμός, όχι διαγραφή (βλ. lib/posting.js).
  try {
    removeEntriesBySource(db, "invoice", inv.id);
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }

  const isCredit = inv.type === "credit";

  // Πώληση παρακαταθήκης: το εμπόρευμα είχε φύγει από την αποθήκη μας ΗΔΗ όταν στάλθηκε στο κατάστημα, και η
  // πώληση το αφαίρεσε από το κατάστημα. Άρα η διαγραφή το επιστρέφει ΣΤΟ κατάστημα (όχι στη δική μας αποθήκη)
  // και σβήνει τις αντίστοιχες εγγραφές πωλήσεων παρακαταθήκης.
  if (inv.sourceType === "consignment" && inv.sourceId && !isCredit) {
    for (const it of inv.items || []) {
      if (!it.productId) continue;
      const p = db.products.find((x) => x.id === it.productId);
      if (!p) continue;
      p.consignmentStock = p.consignmentStock || [];
      const entry = p.consignmentStock.find((c) => c.storeId === inv.sourceId);
      if (entry) entry.quantity = Math.round((Number(entry.quantity || 0) + Number(it.quantity)) * 1000) / 1000;
      else p.consignmentStock.push({ storeId: inv.sourceId, quantity: Number(it.quantity) });
    }
    db.consignmentSales = (db.consignmentSales || []).filter((x) => x.invoiceId !== inv.id);

    // Η προμήθεια που είχε γραφτεί προς το κατάστημα φεύγει μαζί, εφόσον δεν έχει ήδη πληρωθεί.
    const ex = inv.commissionExpenseId ? (db.expenses || []).find((x) => x.id === inv.commissionExpenseId) : null;
    if (ex && !Number(ex.paidAmount || 0)) {
      try {
        removeEntriesBySource(db, "expense", ex.id);
      } catch (e) {
        if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
        throw e;
      }
      db.expenses = db.expenses.filter((x) => x.id !== ex.id);
      const n = Number(String(ex.number).match(/(\d+)$/)?.[1]);
      if (n && n === (db.counters.expense || 1) - 1) db.counters.expense = n;
    }
    // Το τιμολόγιο προμήθειας φεύγει μαζί με το έξοδο (αν το έξοδο έχει ήδη πληρωθεί, μένει και αυτό).
    if ((!ex || !Number(ex.paidAmount || 0)) && inv.commissionInvoiceId) {
      const ci = (db.commissionInvoices || []).find((x) => x.id === inv.commissionInvoiceId);
      db.commissionInvoices = (db.commissionInvoices || []).filter((x) => x.id !== inv.commissionInvoiceId);
      if (ci && Number(ci.aa) === (db.counters.commissionInvoice || 1) - 1) db.counters.commissionInvoice = Number(ci.aa);
    }
  }

  // Κανονικό παραστατικό: είχε βγάλει στοκ → επιστροφή (+). Πιστωτικό: είχε προσθέσει στοκ → αφαίρεση (−).
  for (const it of inv.sourceType === "consignment" && !isCredit ? [] : inv.items || []) {
    if (!it.productId) continue;
    const p = db.products.find((x) => x.id === it.productId);
    if (p && p.trackStock !== false) {
      const delta = isCredit ? -Number(it.quantity) : Number(it.quantity);
      p.stock = Math.round((Number(p.stock || 0) + delta) * 1000) / 1000;
      if (delta > 0) incrementWarehouseStocks(p, delta);
      else decrementWarehouseStocks(p, -delta);
      db.stockMovements.unshift({
        id: uid(), productId: p.id, productName: p.name,
        type: isCredit ? "out" : "in", quantity: Number(it.quantity),
        reason: serverT(db.settings.language, "stock.reasonVoid", { number: inv.number }),
        ref: inv.id, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
      });
    }
  }

  // Αν διαγράφεται πιστωτικό, ξεκλείδωσε το αρχικό παραστατικό.
  if (isCredit && inv.relatedInvoiceId) {
    const orig = db.invoices.find((x) => x.id === inv.relatedInvoiceId);
    if (orig) { delete orig.creditNoteId; delete orig.creditNoteNumber; }
  }

  // Αν διαγράφεται το πιο πρόσφατο παραστατικό της σειράς του (δεν υπάρχει τίποτα μετά του),
  // επανάφερε τον μετρητή ώστε το επόμενο να πάρει τον ίδιο αριθμό — όχι κενό στην αρίθμηση.
  const counterKey = inv.type === "timologio" ? "invoice" : inv.type === "credit" ? "credit" : "receipt";
  if (Number(inv.aa) === (db.counters[counterKey] || 1) - 1) {
    db.counters[counterKey] = Number(inv.aa);
  }

  db.invoices = db.invoices.filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
