import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  return NextResponse.json(readDB().reorderList || []);
}

// Προσθήκη προϊόντος στη λίστα αγορών — αν υπάρχει ήδη, αθροίζει την ποσότητα αντί να
// δημιουργήσει διπλή γραμμή (π.χ. αν ο χρήστης το προσθέσει ξανά αργότερα από άλλη σελίδα).
export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const product = db.products.find((x) => x.id === body.productId);
  if (!product) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const qty = Number(body.quantity) > 0 ? Number(body.quantity) : 1;
  db.reorderList = db.reorderList || [];
  const existing = db.reorderList.find((x) => x.productId === body.productId);
  if (existing) {
    existing.quantity = Math.round((Number(existing.quantity) + qty) * 1000) / 1000;
  } else {
    db.reorderList.unshift({
      id: uid(),
      productId: product.id,
      productName: product.name,
      unit: product.unit || "pcs",
      quantity: qty,
      addedAt: new Date().toISOString(),
    });
  }
  writeDB(db);
  return NextResponse.json(db.reorderList);
}
