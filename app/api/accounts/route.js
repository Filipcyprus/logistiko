import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { ensureAccounts } from "@/lib/posting";
import { ACCOUNT_TYPES, sortByNumber } from "@/lib/accounts";

// Λογιστικό Σχέδιο — ο χρήστης μπορεί να προσθέσει δικούς του λογαριασμούς, να μετονομάσει
// υπάρχοντες και να απενεργοποιήσει όσους δεν χρησιμοποιεί. Οι συστημικοί λογαριασμοί (isSystem)
// δεν διαγράφονται ποτέ — τους χρειάζεται η αυτόματη καταχώριση.
export async function GET() {
  const db = readDB();
  const added = ensureAccounts(db);
  if (added > 0) writeDB(db); // πρώτη φορά: αποθήκευσε το αρχικό σχέδιο
  return NextResponse.json(sortByNumber(db.accounts));
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  ensureAccounts(db);

  const number = String(body.number || "").trim();
  const name = String(body.name || "").trim();
  if (!number) return NextResponse.json({ error: "errors.accountNumberRequired" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "errors.nameRequired" }, { status: 400 });
  if (!ACCOUNT_TYPES.includes(body.type)) return NextResponse.json({ error: "errors.accountTypeRequired" }, { status: 400 });
  if (db.accounts.some((a) => String(a.number) === number)) {
    return NextResponse.json({ error: "errors.accountNumberTaken" }, { status: 400 });
  }

  const rec = {
    id: uid(),
    number,
    name,
    nameKey: null,
    systemKey: null,
    type: body.type,
    isSystem: false,
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.accounts.push(rec);
  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}
