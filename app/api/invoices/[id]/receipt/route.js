import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Έκδοση απόδειξης πληρωμής για παραστατικό που καταχωρήθηκε ήδη ως εξοφλημένο κατά
// τη δημιουργία του (π.χ. τιμολόγιο με μετρητά επί τόπου) — χωρίς ξεχωριστή κίνηση
// "πληρωμής" στο /api/payments, αφού δεν άλλαξε ποτέ η κατάσταση εξόφλησης του.
export async function POST(_req, { params }) {
  const db = readDB();
  const inv = db.invoices.find((x) => x.id === params.id);
  if (!inv) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (inv.type === "credit" || inv.isPaymentReceipt) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }
  if (inv.status !== "paid") {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }
  if ((inv.paymentReceipts || []).length > 0) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }

  const seq = db.counters.receipt || 1;
  const number = `${db.settings.receiptPrefix || "RCT-"}${inv.series || db.settings.series || "A"}-${String(seq).padStart(5, "0")}`;

  const receipt = {
    id: uid(),
    number,
    type: "apodeixi",
    isPaymentReceipt: true,
    series: inv.series || db.settings.series || "A",
    aa: seq,
    date: new Date().toISOString().slice(0, 10),
    customerId: inv.customerId,
    customer: inv.customer,
    relatedInvoiceId: inv.id,
    relatedNumber: inv.number,
    items: [{
      productId: null,
      description: serverT(db.settings.language, "invoices.paymentReceiptLineDesc", { number: inv.number }),
      quantity: 1,
      unit: serverT(db.settings.language, "common.unit"),
      unitPrice: Number(inv.total),
      vatRate: 0,
      discount: 0,
    }],
    net: Number(inv.total),
    vat: 0,
    total: Number(inv.total),
    paymentMethod: inv.paymentMethod,
    status: "paid",
    paidAmount: Number(inv.total),
    notes: "",
    sourceType: "invoice",
    sourceId: inv.id,
    createdAt: new Date().toISOString(),
  };

  db.invoices.unshift(receipt);
  db.counters.receipt = seq + 1;
  inv.paymentReceipts = [...(inv.paymentReceipts || []), { id: receipt.id, number: receipt.number }];

  writeDB(db);
  return NextResponse.json(receipt, { status: 201 });
}
