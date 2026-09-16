import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { repostSource, removeEntriesBySource } from "@/lib/posting";
import { entryForExpense } from "@/lib/postingRules";

// Κάθε αλλαγή/διαγραφή εξόδου ΠΡΕΠΕΙ να ενημερώνει και το Γενικό Καθολικό — αλλιώς τα βιβλία
// δείχνουν ποσό που δεν υπάρχει πια στα παραστατικά. Σε κλειδωμένη περίοδο δεν αλλάζει τίποτα:
// η σωστή κίνηση εκεί είναι αντιλογισμός σε ανοιχτή περίοδο.
export async function PUT(request, { params }) {
  const patch = await request.json();
  for (const k of ["net", "vat", "amount"]) {
    if (patch[k] != null) patch[k] = Number(patch[k]);
  }

  const db = readDB();
  const rec = (db.expenses || []).find((x) => x.id === params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  Object.assign(rec, patch, { updatedAt: new Date().toISOString() });

  try {
    repostSource(db, "expense", rec.id, entryForExpense(db, rec));
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }

  writeDB(db);
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  const db = readDB();
  try {
    removeEntriesBySource(db, "expense", params.id);
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }
  db.expenses = (db.expenses || []).filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
