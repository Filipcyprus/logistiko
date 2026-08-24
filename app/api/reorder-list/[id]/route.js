import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function PUT(request, { params }) {
  const patch = await request.json();
  const db = readDB();
  const item = (db.reorderList || []).find((x) => x.id === params.id);
  if (!item) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (patch.quantity !== undefined) item.quantity = Math.max(0, Number(patch.quantity) || 0);
  writeDB(db);
  return NextResponse.json(item);
}

export async function DELETE(_req, { params }) {
  const db = readDB();
  db.reorderList = (db.reorderList || []).filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
