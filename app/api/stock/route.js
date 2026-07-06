import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Χειροκίνητη κίνηση αποθήκης (παραλαβή, απογραφή, καταστροφή κ.λπ.)
export async function GET() {
  const db = readDB();
  return NextResponse.json(db.stockMovements || []);
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const p = db.products.find((x) => x.id === body.productId);
  if (!p) return NextResponse.json({ error: "errors.productNotFound" }, { status: 404 });

  const qty = Number(body.quantity || 0);
  const type = body.type; // "in" | "out" | "set"

  if (type === "set") {
    p.stock = qty;
  } else if (type === "out") {
    p.stock = Math.round((Number(p.stock || 0) - qty) * 1000) / 1000;
  } else {
    p.stock = Math.round((Number(p.stock || 0) + qty) * 1000) / 1000;
  }

  const movement = {
    id: uid(),
    productId: p.id,
    productName: p.name,
    type: type === "set" ? "adjust" : type,
    quantity: type === "set" ? qty : qty,
    reason: body.reason || serverT(db.settings.language, type === "in" ? "stock.reasonReceived" : type === "out" ? "stock.reasonUsed" : "stock.reasonCount"),
    ref: null,
    date: body.date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  db.stockMovements.unshift(movement);
  writeDB(db);
  return NextResponse.json({ product: p, movement });
}
