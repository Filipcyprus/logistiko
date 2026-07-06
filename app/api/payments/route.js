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

  // Ενημέρωση κατάστασης εξόφλησης παραστατικού (αν συνδέεται)
  if (payment.invoiceId) {
    const inv = db.invoices.find((x) => x.id === payment.invoiceId);
    if (inv) {
      inv.paidAmount = Math.round(((Number(inv.paidAmount || 0)) + amount) * 100) / 100;
      inv.status = inv.paidAmount + 0.001 >= Number(inv.total) ? "paid" : "unpaid";
    }
  }

  db.payments.unshift(payment);
  writeDB(db);
  return NextResponse.json(payment, { status: 201 });
}
