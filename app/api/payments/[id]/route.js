import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function DELETE(_req, { params }) {
  const db = readDB();
  const pay = db.payments.find((x) => x.id === params.id);
  if (pay && pay.invoiceId) {
    const inv = db.invoices.find((x) => x.id === pay.invoiceId);
    if (inv) {
      inv.paidAmount = Math.round((Number(inv.paidAmount || 0) - Number(pay.amount)) * 100) / 100;
      if (inv.paidAmount < 0) inv.paidAmount = 0;
      inv.status = inv.paidAmount + 0.001 >= Number(inv.total) ? "paid" : "unpaid";
    }
  }
  db.payments = db.payments.filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
