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
  // Εκπτώσεις ανά μάρκα/κατηγορία: { type: "brand"|"category", value, percent }. Καθαρίζονται εδώ,
  // όχι μόνο στη φόρμα — μια έκπτωση 150% ή χωρίς όνομα θα χάλαγε τις τιμές του B2B link.
  if (patch.discountRules != null) {
    const seen = new Set();
    patch.discountRules = (Array.isArray(patch.discountRules) ? patch.discountRules : [])
      .map((r) => ({ type: r?.type === "category" ? "category" : r?.type === "brand" ? "brand" : "", value: String(r?.value ?? "").trim(), percent: Number(r?.percent) }))
      .filter((r) => r.type && r.value && Number.isFinite(r.percent) && r.percent > 0 && r.percent <= 100)
      .filter((r) => { const k = r.type + "|" + r.value.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  const rec = update("customers", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("customers", params.id);
  return NextResponse.json({ ok: true });
}
