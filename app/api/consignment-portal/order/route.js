import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { verifyPortalSession } from "@/lib/portalAuth";
import { logActivity } from "@/lib/audit";

// Αίτημα αναπλήρωσης αποθέματος από το ίδιο το κατάστημα παρακαταθήκης.
// Δεν στέλνει απόθεμα αυτόματα — δημιουργεί εκκρεμές αίτημα που βλέπει ο ιδιοκτήτης.
export async function POST(request) {
  const session = await verifyPortalSession(request, "consignment");
  if (!session) return NextResponse.json({ error: "errors.loginRequired" }, { status: 401 });

  const body = await request.json();
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({ productId: it.productId, quantity: Number(it.quantity || 0) }))
    .filter((it) => it.productId && it.quantity > 0);
  if (items.length === 0) return NextResponse.json({ error: "errors.needLine" }, { status: 400 });

  const db = readDB();
  const store = (db.consignmentStores || []).find((s) => s.id === session.linkedId);
  if (!store) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const itemsWithNames = items.map((it) => {
    const p = db.products.find((x) => x.id === it.productId);
    return { productId: it.productId, productName: p?.name || "", quantity: it.quantity };
  });

  const order = {
    id: uid(),
    storeId: store.id,
    storeName: store.name,
    items: itemsWithNames,
    notes: body.notes || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.consignmentOrders = db.consignmentOrders || [];
  db.consignmentOrders.unshift(order);
  writeDB(db);

  await logActivity(request, "consignment_order", { store: store.name, itemCount: items.length });
  return NextResponse.json(order, { status: 201 });
}
