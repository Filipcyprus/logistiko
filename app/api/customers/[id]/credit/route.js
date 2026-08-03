import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

// Πίστωση (ή διόρθωση) υπολοίπου πελάτη — π.χ. ανταμοιβή για παραπομπή νέου πελάτη.
// Το υπόλοιπο εμφανίζεται στο B2B portal του και καταναλώνεται αυτόματα στην επόμενη παραγγελία.
export async function POST(request, { params }) {
  const body = await request.json();
  const amount = Number(body.amount);
  if (!amount) return NextResponse.json({ error: "errors.invalidAmount" }, { status: 400 });

  const db = readDB();
  const c = db.customers.find((x) => x.id === params.id);
  if (!c) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  c.creditBalance = Math.round(((Number(c.creditBalance) || 0) + amount) * 100) / 100;
  c.creditHistory = [
    { id: uid(), date: new Date().toISOString().slice(0, 10), amount, notes: body.notes || "", createdAt: new Date().toISOString() },
    ...(c.creditHistory || []),
  ];

  writeDB(db);
  return NextResponse.json({ creditBalance: c.creditBalance, creditHistory: c.creditHistory });
}
