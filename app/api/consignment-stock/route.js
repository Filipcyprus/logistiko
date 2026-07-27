import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Αποστολή αποθέματος (ενδεχομένως πολλών προϊόντων) σε κατάστημα παρακαταθήκης —
// μειώνει το δικό μας απόθεμα και δημιουργεί ένα δελτίο αποστολής (consignmentDeliveries)
// για εκτύπωση, με τα στοιχεία της επιχείρησης και του καταστήματος.
export async function POST(request) {
  const body = await request.json();
  const storeId = body.storeId;
  const date = body.date || new Date().toISOString().slice(0, 10);
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({ productId: it.productId, quantity: Number(it.quantity || 0) }))
    .filter((it) => it.productId && it.quantity > 0);

  if (!storeId || items.length === 0) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }

  const db = readDB();
  const store = db.consignmentStores.find((s) => s.id === storeId);
  if (!store) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const resolved = [];
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (!p) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
    if (Number(p.stock || 0) < it.quantity) {
      return NextResponse.json({ error: "errors.insufficientStock" }, { status: 400 });
    }
    resolved.push({ product: p, quantity: it.quantity });
  }

  const deliveryItems = [];
  for (const { product: p, quantity: qty } of resolved) {
    p.stock = Math.round((Number(p.stock || 0) - qty) * 1000) / 1000;
    p.consignmentStock = p.consignmentStock || [];
    const entry = p.consignmentStock.find((c) => c.storeId === storeId);
    if (entry) entry.quantity = Math.round((Number(entry.quantity || 0) + qty) * 1000) / 1000;
    else p.consignmentStock.push({ storeId, quantity: qty });

    db.stockMovements.unshift({
      id: uid(),
      productId: p.id,
      productName: p.name,
      type: "out",
      quantity: qty,
      reason: serverT(db.settings.language, "consignment.reasonSent", { store: store.name }),
      ref: storeId,
      date,
      createdAt: new Date().toISOString(),
    });

    deliveryItems.push({ productId: p.id, productName: p.name, unit: p.unit, quantity: qty });
  }

  const delivery = {
    id: uid(),
    storeId,
    storeName: store.name,
    date,
    items: deliveryItems,
    createdAt: new Date().toISOString(),
  };
  db.consignmentDeliveries = db.consignmentDeliveries || [];
  db.consignmentDeliveries.unshift(delivery);

  writeDB(db);
  return NextResponse.json({ ok: true, deliveryId: delivery.id });
}
