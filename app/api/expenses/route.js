import { NextResponse } from "next/server";
import { list, readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  return NextResponse.json(list("expenses"));
}

// Κάθε έξοδο παίρνει έναν μοναδικό, συνεχόμενο αριθμό (π.χ. EXP-00001) — ίδια λογική με τους
// αριθμούς παραστατικών, ώστε να εντοπίζεται εύκολα (π.χ. στο Ημερολόγιο Κινήσεων).
export async function POST(request) {
  const body = await request.json();
  if (!body.description || !body.description.trim()) {
    return NextResponse.json({ error: "errors.descriptionRequired" }, { status: 400 });
  }
  const db = readDB();
  const seq = db.counters.expense || 1;
  const number = `${db.settings.expensePrefix || "EXP-"}${String(seq).padStart(5, "0")}`;
  const rec = {
    id: uid(),
    number,
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || "general",
    description: body.description.trim(),
    supplier: body.supplier || "",
    net: Number(body.net || 0),
    vat: Number(body.vat || 0),
    amount: Number(body.amount || 0),
    paymentMethod: body.paymentMethod || "cash",
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };
  db.expenses = [rec, ...(db.expenses || [])];
  db.counters.expense = seq + 1;
  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}
