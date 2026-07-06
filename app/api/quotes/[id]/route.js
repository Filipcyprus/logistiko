import { NextResponse } from "next/server";
import { getDoc, updateDoc, removeDoc } from "@/lib/docs";

export async function GET(_req, { params }) {
  const rec = getDoc("quotes", params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PUT(request, { params }) {
  const patch = await request.json();
  const rec = updateDoc("quotes", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  removeDoc("quotes", params.id);
  return NextResponse.json({ ok: true });
}
