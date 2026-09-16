import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { postEntry } from "@/lib/posting";
import { entryForSupplierPayment } from "@/lib/postingRules";
import { purchaseTotal, syncExpensePaid } from "@/lib/payables";

// Πληρωμή ΠΡΟΣ προμηθευτή — εξοφλεί (πλήρως ή μερικώς) ό,τι χρωστάμε επί πιστώσει: είτε
// Παραγγελία Αγοράς που παραλήφθηκε με paymentMethod "credit" (app/api/purchases/[id]/route.js),
// είτε τιμολόγιο εξόδου που ήρθε απλήρωτο (app/api/expenses/route.js). Καθρέφτης του
// /api/payments (εισπράξεις από πελάτες) για την αντίθετη κατεύθυνση.
export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const amount = Number(body.amount || 0);

  const expense = body.expenseId ? (db.expenses || []).find((x) => x.id === body.expenseId) : null;
  if (body.expenseId && !expense) {
    return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  }
  // Ένα έξοδο κουβαλάει το όνομα του προμηθευτή ακόμα κι όταν δεν είναι συνδεδεμένο με καρτέλα
  // (το πεδίο είναι ελεύθερο κείμενο) — αρκεί για να καταγραφεί η πληρωμή.
  const supplierId = body.supplierId || expense?.supplierId || null;
  if (!supplierId && !expense) {
    return NextResponse.json({ error: "errors.missingSupplier" }, { status: 400 });
  }
  if (amount <= 0) {
    return NextResponse.json({ error: "errors.invalidAmount" }, { status: 400 });
  }

  const supplier = supplierId ? db.suppliers.find((x) => x.id === supplierId) : null;
  const payment = {
    id: uid(),
    supplierId,
    supplierName: supplier?.name || expense?.supplier || "",
    purchaseId: body.purchaseId || null,
    expenseId: body.expenseId || null,
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
      po.paid = po.paidAmount + 0.001 >= purchaseTotal(po);
    }
  }

  db.supplierPayments = [payment, ...(db.supplierPayments || [])];
  if (expense) syncExpensePaid(db, expense); // μετά την προσθήκη: το πληρωμένο ποσό βγαίνει από τις πληρωμές

  try {
    const entryInput = entryForSupplierPayment(db, payment);
    if (entryInput) postEntry(db, { ...entryInput, source: { type: "supplierPayment", id: payment.id } });
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }

  writeDB(db);
  return NextResponse.json(payment, { status: 201 });
}
