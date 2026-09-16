import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { postEntry, reverseEntry } from "@/lib/posting";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Χειροκίνητα άρθρα (adjusting entries) — αυτό που κάνει ο λογιστής για αποσβέσεις, δεδουλευμένα,
// αρχικά υπόλοιπα, διορθώσεις. Χωρίς αυτό δεν είναι πραγματικό λογιστικό πρόγραμμα.
//
// POST /api/journal-entries            { date, memo, lines: [{accountId, debit, credit, memo}] }
// POST /api/journal-entries?reverse=ID { date }   → αντιλογισμός υπάρχοντος άρθρου
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const reverseId = searchParams.get("reverse");
  const body = await request.json().catch(() => ({}));
  const db = readDB();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const createdBy = session?.username || null;

  try {
    if (reverseId) {
      const reversal = reverseEntry(db, reverseId, { date: body.date, createdBy });
      writeDB(db);
      return NextResponse.json(reversal, { status: 201 });
    }

    const lines = (body.lines || []).filter((l) => Number(l.debit) || Number(l.credit));
    if (lines.length < 2) return NextResponse.json({ error: "errors.needTwoLines" }, { status: 400 });

    const entry = postEntry(db, {
      date: body.date,
      memo: body.memo || "",
      source: { type: "manual", id: null },
      lines,
      createdBy,
    });
    writeDB(db);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    if (e.code === "NOT_BALANCED") return NextResponse.json({ error: "errors.entryNotBalanced", details: e.details }, { status: 400 });
    if (e.code === "ALREADY_REVERSED") return NextResponse.json({ error: "errors.alreadyReversed" }, { status: 400 });
    if (e.code === "NOT_FOUND") return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
    console.error("Σφάλμα καταχώρισης άρθρου:", e);
    return NextResponse.json({ error: "common.error" }, { status: 500 });
  }
}
