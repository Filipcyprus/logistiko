import { NextResponse } from "next/server";
import { list, insert, readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { generateBarcode } from "@/lib/barcode";

export async function GET() {
  return NextResponse.json(list("products"));
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.productNameRequired" }, { status: 400 });
  }
  const db = readDB();
  const defVat = db.settings.vatRate ?? 19;
  const productType = body.productType || "product";
  const isService = productType === "service";
  const wholesalePrice = Number(body.wholesalePrice ?? body.price ?? 0);
  const trackStock = isService ? false : body.trackStock !== false;
  const initialStock = isService ? 0 : Number(body.stock || 0);

  const rec = insert("products", {
    code: body.code || "",
    barcode: body.barcode?.trim() || generateBarcode(),
    name: body.name.trim(),
    brand: body.brand || "",
    category: body.category || "",
    supplierId: body.supplierId || "",
    productType,
    image: body.image || "",
    unit: body.unit || serverT(db.settings.language, "common.unit"),
    price: wholesalePrice,
    wholesalePrice,
    retailPrice: body.retailPrice !== "" && body.retailPrice != null ? Number(body.retailPrice) : null,
    cost: Number(body.cost || 0),
    vatRate: body.vatRate != null ? Number(body.vatRate) : defVat,
    stock: initialStock,
    lowStock: Number(body.lowStock || 0),
    warehouse: body.warehouse || "",
    binLocation: body.binLocation || "",
    trackStock,
    trackSerial: !!body.trackSerial,
    trackBatch: !!body.trackBatch,
    trackExpiry: !!body.trackExpiry,
    notes: body.notes || "",
  });

  if (trackStock && initialStock > 0) {
    const db2 = readDB();
    db2.stockMovements.unshift({
      id: uid(),
      productId: rec.id,
      productName: rec.name,
      type: "in",
      quantity: initialStock,
      reason: serverT(db2.settings.language, "stock.reasonInitial"),
      ref: rec.id,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });
    writeDB(db2);
  }

  return NextResponse.json(rec, { status: 201 });
}
