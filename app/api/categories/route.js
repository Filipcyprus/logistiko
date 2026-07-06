import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  return NextResponse.json(readDB().categories || []);
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.categoryNameRequired" }, { status: 400 });
  }
  const db = readDB();
  const rec = { id: uid(), name: body.name.trim() };
  db.categories = [...(db.categories || []), rec];
  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const db = readDB();
  db.categories = (db.categories || []).filter((c) => c.id !== id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
