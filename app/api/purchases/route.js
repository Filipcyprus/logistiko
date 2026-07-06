import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { computeTotals } from "@/lib/format";

export async function GET() {
  return NextResponse.json(readDB().purchases || []);
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();

  const items = (body.items || []).filter((it) => it.description && Number(it.quantity) > 0);
  if (items.length === 0) return NextResponse.json({ error: "errors.needLine" }, { status: 400 });
  if (!body.supplierId) return NextResponse.json({ error: "errors.missingSupplier" }, { status: 400 });

  const seq = db.counters.purchase || 1;
  const number = `${db.settings.purchasePrefix || "PO-"}${String(seq).padStart(5, "0")}`;
  const totals = computeTotals(items);

  let supplierSnapshot = null;
  const sup = db.suppliers.find((x) => x.id === body.supplierId);
  if (sup) supplierSnapshot = { id: sup.id, name: sup.name, afm: sup.afm, address: sup.address, city: sup.city, phone: sup.phone };

  const doc = {
    id: uid(),
    number,
    date: body.date || new Date().toISOString().slice(0, 10),
    expectedDate: body.expectedDate || "",
    supplierId: body.supplierId,
    supplier: supplierSnapshot,
    items: items.map((it) => ({
      productId: it.productId || null,
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit || "pcs",
      unitPrice: Number(it.unitPrice || 0),
      vatRate: Number(it.vatRate || 0),
      discount: Number(it.discount || 0),
    })),
    net: totals.net,
    vat: totals.vat,
    total: totals.total,
    status: body.status || "draft", // draft | sent | received
    received: false,
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };

  db.purchases.unshift(doc);
  db.counters.purchase = seq + 1;
  writeDB(db);
  return NextResponse.json(doc, { status: 201 });
}
