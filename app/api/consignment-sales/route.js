import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { registerConsignmentSales } from "@/lib/stockHelpers";
import { postEntry } from "@/lib/posting";
import { entryForInvoice, entryForExpense } from "@/lib/postingRules";
import { logActivity } from "@/lib/audit";

export async function GET() {
  const db = readDB();
  return NextResponse.json(db.consignmentSales || []);
}

// Καταχώρηση πώλησης (μία ή περισσότερες γραμμές) σε κατάστημα παρακαταθήκης — μειώνει το απόθεμα εκεί.
// Με invoice:true βγαίνει τιμολόγιο προς το κατάστημα (με γραμμή Commission), αλλιώς απόδειξη εσόδου.
// Μόνο τώρα αναγνωρίζεται το έσοδο, όχι όταν στάλθηκε το απόθεμα.
export async function POST(request) {
  const body = await request.json();
  const storeId = body.storeId;
  const lines = Array.isArray(body.lines)
    ? body.lines
    : [{ productId: body.productId, quantity: body.quantity, unitPrice: body.unitPrice }];
  if (!storeId) return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });

  const db = readDB();
  const result = registerConsignmentSales(db, {
    storeId, lines, date: body.date, invoice: !!body.invoice, holdMoney: !!body.holdMoney, commissionPercent: body.commissionPercent, paymentMethod: body.paymentMethod,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.error === "errors.notFound" ? 404 : 400 });

  // Καταχώριση στο Γενικό Καθολικό (όπως κάθε παραστατικό). Σε κλειδωμένη περίοδο δεν γράφεται τίποτα.
  try {
    const entryInput = entryForInvoice(db, result.invoice);
    if (entryInput) postEntry(db, { ...entryInput, source: { type: "invoice", id: result.invoice.id } });
    if (result.expense) {
      const expInput = entryForExpense(db, result.expense);
      if (expInput) postEntry(db, { ...expInput, source: { type: "expense", id: result.expense.id } });
    }
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }

  writeDB(db);
  await logActivity(request, "consignment_sale", {
    store: result.invoice.shopName, number: result.invoice.number, type: result.invoice.type, total: result.invoice.total,
    commission: result.commissionAmount || 0, holdMoney: !!body.holdMoney,
  });
  return NextResponse.json({ invoice: result.invoice, sales: result.sales, commissionAmount: result.commissionAmount, expense: result.expense || null }, { status: 201 });
}
