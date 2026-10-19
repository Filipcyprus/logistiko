import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { incrementWarehouseStocks } from "@/lib/stockHelpers";
import { postEntry } from "@/lib/posting";
import { entryForInvoice } from "@/lib/postingRules";
import { computeTotals } from "@/lib/format";

// Έκδοση πιστωτικού τιμολογίου για ολόκληρο το αρχικό παραστατικό.
export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const db = readDB();
  const orig = db.invoices.find((x) => x.id === params.id);
  if (!orig) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (orig.type === "credit") return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  if (orig.creditNoteId) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }

  // Ολόκληρο το παραστατικό, ή μόνο συγκεκριμένες γραμμές/ποσότητες: lines = [{ index, quantity }].
  let creditItems;
  let partial = false;
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    creditItems = [];
    for (const l of body.lines) {
      const src = (orig.items || [])[Number(l.index)];
      const qty = Math.round(Number(l.quantity) * 1000) / 1000;
      if (!src || !(qty > 0) || qty > Number(src.quantity) + 1e-9) {
        return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
      }
      creditItems.push({ ...src, quantity: qty, unitPrice: Number(src.unitPrice) });
    }
    const sameAsAll = creditItems.length === (orig.items || []).length && creditItems.every((it, i) => Number(it.quantity) === Number(orig.items[i].quantity));
    partial = !sameAsAll;
  }
  if (!creditItems) creditItems = (orig.items || []).map((it) => ({ ...it, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) }));

  // Η έκπτωση επί του συνόλου μοιράζεται αναλογικά στο μέρος που επιστρέφεται.
  const origGross = computeTotals(orig.items || [], 0).subtotal;
  const creditGross = computeTotals(creditItems, 0).subtotal;
  const discountShare = partial && origGross > 0 ? Math.round(Number(orig.invoiceDiscount || 0) * (creditGross / origGross) * 100) / 100 : Number(orig.invoiceDiscount || 0);
  const t = partial ? computeTotals(creditItems, discountShare) : null;

  const seq = db.counters.credit || 1;
  const number = `${db.settings.creditPrefix || "CN-"}${db.settings.series || "A"}-${String(seq).padStart(5, "0")}`;

  const credit = {
    id: uid(),
    number,
    type: "credit",
    series: orig.series,
    aa: seq,
    date: new Date().toISOString().slice(0, 10),
    customerId: orig.customerId,
    customer: orig.customer,
    relatedInvoiceId: orig.id,
    relatedNumber: orig.number,
    // Αρνητικά ποσά ώστε να μειώνουν πωλήσεις/ΦΠΑ/υπόλοιπο σε αναφορές & καρτέλα.
    items: creditItems,
    net: partial ? -t.net : -Number(orig.net),
    vat: partial ? -t.vat : -Number(orig.vat),
    total: partial ? -t.total : -Number(orig.total),
    // Μεταφέρεται ώστε η ανάλυση ανά συντελεστή ΦΠΑ να αθροίζει σωστά στο καθαρό ποσό.
    invoiceDiscount: discountShare,
    subtotal: partial ? t.subtotal : Number(orig.subtotal || 0),
    partial,
    // Εξοφλημένο αρχικό → τα χρήματα επιστρέφονται με τον ίδιο τρόπο (μετρητά/τράπεζα).
    // Απλήρωτο αρχικό → δεν επιστρέφονται χρήματα, απλώς μειώνεται ό,τι χρωστάει ο πελάτης.
    paymentMethod: orig.paymentMethod,
    status: orig.status === "paid" ? "paid" : "unpaid",
    paidAmount: orig.status === "paid" ? (partial ? -t.total : -Number(orig.total)) : 0,
    notes: "",
    createdAt: new Date().toISOString(),
  };

  // Επιστροφή αποθέματος (τα είδη γυρίζουν πίσω).
  for (const it of creditItems) {
    if (!it.productId) continue;
    const p = db.products.find((x) => x.id === it.productId);
    if (p && p.trackStock !== false) {
      p.stock = Math.round((Number(p.stock || 0) + Number(it.quantity)) * 1000) / 1000;
      incrementWarehouseStocks(p, Number(it.quantity));
      db.stockMovements.unshift({
        id: uid(), productId: p.id, productName: p.name, type: "in",
        quantity: Number(it.quantity),
        reason: serverT(db.settings.language, "stock.reasonCreditNote", { number }),
        ref: credit.id, date: credit.date, createdAt: new Date().toISOString(),
      });
    }
  }

  orig.creditNoteId = credit.id;
  orig.creditNoteNumber = number;

  db.invoices.unshift(credit);
  db.counters.credit = seq + 1;

  // Χωρίς άρθρο στο Καθολικό, η πώληση θα έμενε στα αποτελέσματα και στον ΦΠΑ σαν να μην ακυρώθηκε.
  try {
    const entryInput = entryForInvoice(db, credit);
    if (entryInput) postEntry(db, { ...entryInput, source: { type: "invoice", id: credit.id } });
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }

  writeDB(db);
  return NextResponse.json(credit, { status: 201 });
}
