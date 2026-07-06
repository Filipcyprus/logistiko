import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Έκδοση πιστωτικού τιμολογίου για ολόκληρο το αρχικό παραστατικό.
export async function POST(_req, { params }) {
  const db = readDB();
  const orig = db.invoices.find((x) => x.id === params.id);
  if (!orig) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (orig.type === "credit") return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  if (orig.creditNoteId) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }

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
    items: (orig.items || []).map((it) => ({ ...it, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
    net: -Number(orig.net),
    vat: -Number(orig.vat),
    total: -Number(orig.total),
    paymentMethod: orig.paymentMethod,
    status: "paid",
    paidAmount: -Number(orig.total),
    notes: "",
    createdAt: new Date().toISOString(),
  };

  // Επιστροφή αποθέματος (τα είδη γυρίζουν πίσω).
  for (const it of orig.items || []) {
    if (!it.productId) continue;
    const p = db.products.find((x) => x.id === it.productId);
    if (p && p.trackStock !== false) {
      p.stock = Math.round((Number(p.stock || 0) + Number(it.quantity)) * 1000) / 1000;
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
  writeDB(db);
  return NextResponse.json(credit, { status: 201 });
}
