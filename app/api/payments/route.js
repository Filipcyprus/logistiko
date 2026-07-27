import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

export async function GET() {
  return NextResponse.json(readDB().payments || []);
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const amount = Number(body.amount || 0);
  if (!body.customerId) {
    return NextResponse.json({ error: "errors.missingCustomer" }, { status: 400 });
  }
  if (amount <= 0) {
    return NextResponse.json({ error: "errors.invalidAmount" }, { status: 400 });
  }

  const payment = {
    id: uid(),
    customerId: body.customerId,
    invoiceId: body.invoiceId || null,
    date: body.date || new Date().toISOString().slice(0, 10),
    amount,
    method: body.method || serverT(db.settings.language, "common.paymentMethods.cash"),
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };

  // Ενημέρωση κατάστασης εξόφλησης παραστατικού (αν συνδέεται) + έκδοση απόδειξης πληρωμής
  let receipt = null;
  if (payment.invoiceId) {
    const inv = db.invoices.find((x) => x.id === payment.invoiceId);
    if (inv) {
      inv.paidAmount = Math.round(((Number(inv.paidAmount || 0)) + amount) * 100) / 100;
      inv.status = inv.paidAmount + 0.001 >= Number(inv.total) ? "paid" : "unpaid";

      const seq = db.counters.receipt || 1;
      const number = `${db.settings.receiptPrefix || "RCT-"}${inv.series || db.settings.series || "A"}-${String(seq).padStart(5, "0")}`;
      receipt = {
        id: uid(),
        number,
        type: "apodeixi",
        isPaymentReceipt: true,
        series: inv.series || db.settings.series || "A",
        aa: seq,
        date: payment.date,
        customerId: inv.customerId,
        customer: inv.customer,
        relatedInvoiceId: inv.id,
        relatedNumber: inv.number,
        items: [{
          productId: null,
          description: serverT(db.settings.language, "invoices.paymentReceiptLineDesc", { number: inv.number }),
          quantity: 1,
          unit: serverT(db.settings.language, "common.unit"),
          unitPrice: amount,
          vatRate: 0,
          discount: 0,
        }],
        net: amount,
        vat: 0,
        total: amount,
        paymentMethod: payment.method,
        status: "paid",
        paidAmount: amount,
        notes: "",
        sourceType: "invoice",
        sourceId: inv.id,
        createdAt: new Date().toISOString(),
      };
      db.invoices.unshift(receipt);
      db.counters.receipt = seq + 1;

      inv.paymentReceipts = [...(inv.paymentReceipts || []), { id: receipt.id, number: receipt.number }];
      payment.receiptId = receipt.id;
      payment.receiptNumber = receipt.number;
    }
  }

  db.payments.unshift(payment);
  writeDB(db);
  return NextResponse.json({ ...payment, receipt }, { status: 201 });
}
