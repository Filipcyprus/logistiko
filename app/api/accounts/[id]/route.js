import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { ACCOUNT_TYPES } from "@/lib/accounts";

export async function PUT(request, { params }) {
  const body = await request.json();
  const db = readDB();
  const acc = (db.accounts || []).find((a) => a.id === params.id);
  if (!acc) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  if (body.number != null) {
    const number = String(body.number).trim();
    if (!number) return NextResponse.json({ error: "errors.accountNumberRequired" }, { status: 400 });
    if (db.accounts.some((a) => a.id !== acc.id && String(a.number) === number)) {
      return NextResponse.json({ error: "errors.accountNumberTaken" }, { status: 400 });
    }
    acc.number = number;
  }
  if (body.name != null) acc.name = String(body.name).trim();
  // Ο τύπος συστημικού λογαριασμού δεν αλλάζει — θα χαλούσε τις αυτόματες καταχωρίσεις και τη
  // θέση του στις λογιστικές καταστάσεις.
  if (body.type != null && !acc.isSystem) {
    if (!ACCOUNT_TYPES.includes(body.type)) return NextResponse.json({ error: "errors.accountTypeRequired" }, { status: 400 });
    acc.type = body.type;
  }
  if (body.active != null) acc.active = !!body.active;
  acc.updatedAt = new Date().toISOString();

  writeDB(db);
  return NextResponse.json(acc);
}

export async function DELETE(_req, { params }) {
  const db = readDB();
  const acc = (db.accounts || []).find((a) => a.id === params.id);
  if (!acc) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (acc.isSystem) return NextResponse.json({ error: "errors.systemAccount" }, { status: 400 });

  // Λογαριασμός με κινήσεις δεν διαγράφεται — θα άφηνε "ορφανές" γραμμές στο καθολικό και θα
  // χαλούσε ιστορικές καταστάσεις. Απενεργοποίησέ τον αντ' αυτού.
  const used = (db.journalEntries || []).some((e) => (e.lines || []).some((l) => l.accountId === acc.id));
  if (used) return NextResponse.json({ error: "errors.accountInUse" }, { status: 400 });

  db.accounts = db.accounts.filter((a) => a.id !== acc.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
