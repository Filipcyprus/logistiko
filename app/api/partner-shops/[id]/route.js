import { NextResponse } from "next/server";
import { update, remove } from "@/lib/db";

export async function PUT(request, { params }) {
  const patch = await request.json();
  const rec = update("partnerShops", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("partnerShops", params.id);
  return NextResponse.json({ ok: true });
}
