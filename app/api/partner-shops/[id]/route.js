import { NextResponse } from "next/server";
import { update, remove } from "@/lib/db";

export async function PUT(request, { params }) {
  const patch = await request.json();
  // Email υποχρεωτικό — εκεί στέλνεται αυτόματα κάθε δουλειά που ανατίθεται σε αυτόν τον συνεργάτη.
  if (patch.email !== undefined && !patch.email.trim()) {
    return NextResponse.json({ error: "errors.partnerEmailRequired" }, { status: 400 });
  }
  const rec = update("partnerShops", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("partnerShops", params.id);
  return NextResponse.json({ ok: true });
}
