import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/db";
import { generateBarcode } from "@/lib/barcode";

export async function GET(_req, { params }) {
  const rec = getById("products", params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PUT(request, { params }) {
  let patch = await request.json();
  // Καθαρισμός αριθμητικών πεδίων
  for (const k of ["price", "wholesalePrice", "cost", "vatRate", "stock", "lowStock"]) {
    if (patch[k] != null) patch[k] = Number(patch[k]);
  }
  if (patch.retailPrice != null) {
    patch.retailPrice = patch.retailPrice === "" ? null : Number(patch.retailPrice);
  }
  // Η "τιμή" που χρησιμοποιείται σε παραστατικά/προσφορές ταυτίζεται με τη χονδρική τιμή.
  if (patch.wholesalePrice != null) patch.price = patch.wholesalePrice;
  if (!patch.barcode || !patch.barcode.trim()) {
    const existing = getById("products", params.id);
    patch.barcode = existing?.barcode || generateBarcode();
  }
  const rec = update("products", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("products", params.id);
  return NextResponse.json({ ok: true });
}
