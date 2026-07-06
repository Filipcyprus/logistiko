import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function PUT(request, { params }) {
  const patch = await request.json();
  const db = readDB();
  const a = db.activities.find((x) => x.id === params.id);
  if (!a) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (patch.tags && !Array.isArray(patch.tags)) {
    patch.tags = String(patch.tags).split(",").map((t) => t.trim()).filter(Boolean);
  }
  Object.assign(a, patch);
  writeDB(db);
  return NextResponse.json(a);
}

export async function DELETE(_req, { params }) {
  const db = readDB();
  db.activities = db.activities.filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
