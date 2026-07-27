import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  const db = readDB();
  return NextResponse.json(db.warehouses || []);
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Warehouse name required" }, { status: 400 });
  }
  const db = readDB();
  if (!db.warehouses) db.warehouses = [];
  const warehouse = {
    id: uid(),
    name: body.name.trim(),
    createdAt: new Date().toISOString(),
  };
  db.warehouses.push(warehouse);
  writeDB(db);
  return NextResponse.json(warehouse, { status: 201 });
}

export async function DELETE(request) {
  const body = await request.json();
  const db = readDB();
  if (!db.warehouses) return NextResponse.json({ error: "No warehouses" }, { status: 404 });
  db.warehouses = db.warehouses.filter((w) => w.id !== body.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
