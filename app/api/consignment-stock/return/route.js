import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Επιστροφή αποθέματος από κατάστημα παρακαταθήκης πίσω στη δική μας αποθήκη (αντίστροφο του
// POST /api/consignment-stock) — μειώνει το απόθεμα του καταστήματος, αυξάνει το δικό μας, και
// κρατά ξεχωριστό ιστορικό (consignmentReturns) από τις αποστολές.
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
    const entry = (p.consignmentStock || []).find((c) => c.storeId === storeId);
    const atStore = entry ? Number(entry.quantity || 0) : 0;
    if (atStore < it.quantity) {
      return NextResponse.json({ error: "errors.insufficientStock" }, { status: 400 });
    }
    resolved.push({ product: p, entry, quantity: it.quantity });
  }

  const returnItems = [];
  for (const { product: p, entry, quantity: qty } of resolved) {
    entry.quantity = Math.round((Number(entry.quantity || 0) - qty) * 1000) / 1000;
    if (entry.quantity <= 0) p.consignmentStock = p.consignmentStock.filter((c) => c !== entry);
    p.stock = Math.round((Number(p.stock || 0) + qty) * 1000) / 1000;

    db.stockMovements.unshift({
      id: uid(),
      productId: p.id,
      productName: p.name,
      type: "in",
      quantity: qty,
      reason: serverT(db.settings.language, "consignment.reasonReturned", { store: store.name }),
      ref: storeId,
      date,
      createdAt: new Date().toISOString(),
    });

    returnItems.push({ productId: p.id, productName: p.name, unit: p.unit, quantity: qty });
  }

  const ret = {
    id: uid(),
    storeId,
    storeName: store.name,
    date,
    items: returnItems,
    createdAt: new Date().toISOString(),
  };
  db.consignmentReturns = db.consignmentReturns || [];
  db.consignmentReturns.unshift(ret);

  writeDB(db);
  return NextResponse.json({ ok: true, returnId: ret.id });
}
