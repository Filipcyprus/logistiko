import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/db";

export async function GET(_req, { params }) {
  const rec = getById("suppliers", params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PUT(request, { params }) {
  const patch = await request.json();
  const rec = update("suppliers", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("suppliers", params.id);
  return NextResponse.json({ ok: true });
}
