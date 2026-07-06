import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/db";

export async function GET(_req, { params }) {
  const rec = getById("customers", params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PUT(request, { params }) {
  const patch = await request.json();
  for (const k of ["defaultDiscount", "creditDays"]) {
    if (patch[k] != null) patch[k] = Number(patch[k]);
  }
  const rec = update("customers", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("customers", params.id);
  return NextResponse.json({ ok: true });
}
