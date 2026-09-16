import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  return NextResponse.json(readDB().supplierPayments || []);
}

function poTotal(po) {
  return Math.round((po.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unitCost || 0), 0) * 100) / 100;
}

// Πληρωμή ΠΡΟΣ προμηθευτή — εξοφλεί (πλήρως ή μερικώς) μια αγορά επί πιστώσει (paymentMethod:
// "credit", βλ. app/api/purchases/[id]/route.js). Καθρέφτης του /api/payments (εισπράξεις από
// πελάτες) για την αντίθετη κατεύθυνση· ενημερώνει po.paidAmount/po.paid αν συνδέεται με
// συγκεκριμένη Παραγγελία Αγοράς.
export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const amount = Number(body.amount || 0);
  if (!body.supplierId) {
    return NextResponse.json({ error: "errors.missingSupplier" }, { status: 400 });
  }
  if (amount <= 0) {
    return NextResponse.json({ error: "errors.invalidAmount" }, { status: 400 });
  }

  const supplier = db.suppliers.find((x) => x.id === body.supplierId);
  const payment = {
    id: uid(),
    supplierId: body.supplierId,
    supplierName: supplier?.name || "",
    purchaseId: body.purchaseId || null,
    date: body.date || new Date().toISOString().slice(0, 10),
    amount,
    method: body.method === "bank" ? "bank" : "cash",
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };

  if (payment.purchaseId) {
    const po = db.purchases.find((x) => x.id === payment.purchaseId);
    if (po) {
      po.paidAmount = Math.round(((Number(po.paidAmount || 0)) + amount) * 100) / 100;
      po.paid = po.paidAmount + 0.001 >= poTotal(po);
    }
  }

  db.supplierPayments = [payment, ...(db.supplierPayments || [])];
  writeDB(db);
  return NextResponse.json(payment, { status: 201 });
}
