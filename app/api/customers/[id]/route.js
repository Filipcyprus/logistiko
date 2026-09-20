import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/db";
import { ruleParts, ruleKey } from "@/lib/discountRules";

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
  // Εκπτώσεις ανά συνδυασμό μάρκας / κατηγορίας / υποκατηγορίας: { brand, category, subcategory, percent }.
  // Καθαρίζονται εδώ, όχι μόνο στη φόρμα — μια έκπτωση 150%, ή κανόνας χωρίς κανένα πεδίο (που θα έδινε
  // έκπτωση σε ΟΛΟΝ τον κατάλογο), θα χάλαγε τις τιμές του B2B link. Η παλιά μορφή { type, value } μετατρέπεται.
  if (patch.discountRules != null) {
    const seen = new Set();
    patch.discountRules = (Array.isArray(patch.discountRules) ? patch.discountRules : [])
      .map((r) => { const p = ruleParts(r); return { brand: p.brand.trim(), category: p.category.trim(), subcategory: p.subcategory.trim(), percent: p.percent }; })
      .filter((r) => (r.brand || r.category || r.subcategory) && Number.isFinite(r.percent) && r.percent > 0 && r.percent <= 100)
      .filter((r) => { const k = ruleKey(r); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  const rec = update("customers", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("customers", params.id);
  return NextResponse.json({ ok: true });
}
