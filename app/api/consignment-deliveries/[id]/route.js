import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

export async function GET(request, { params }) {
  const db = readDB();
  const delivery = (db.consignmentDeliveries || []).find((d) => d.id === params.id);
  if (!delivery) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const store = (db.consignmentStores || []).find((s) => s.id === delivery.storeId) || null;

  return NextResponse.json({
    delivery,
    store,
    company: {
      companyName: db.settings.companyName,
      logo: db.settings.logo,
      address: db.settings.address,
      city: db.settings.city,
      postalCode: db.settings.postalCode,
      afm: db.settings.afm,
      phone: db.settings.phone,
      currency: db.settings.currency || "€",
    },
  });
}

// Αναιρεί τις επιπτώσεις μιας αποστολής στο απόθεμα (επιστρέφει στην αποθήκη μας, αφαιρεί από το
// απόθεμα παρακαταθήκης του καταστήματος) και αφαιρεί τις σχετικές κινήσεις αποθέματος. Χρησιμοποιείται
// και για επεξεργασία (αναίρεση + ξανά-εφαρμογή με τα νέα στοιχεία) και για πλήρη διαγραφή.
function reverseDelivery(db, delivery) {
  for (const it of delivery.items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (!p) continue; // το προϊόν μπορεί να έχει διαγραφεί έκτοτε — δεν μπλοκάρουμε την αναίρεση
    p.stock = Math.round((Number(p.stock || 0) + it.quantity) * 1000) / 1000;
    p.consignmentStock = p.consignmentStock || [];
    const entry = p.consignmentStock.find((c) => c.storeId === delivery.storeId);
    if (entry) {
      entry.quantity = Math.round((Number(entry.quantity || 0) - it.quantity) * 1000) / 1000;
      if (entry.quantity <= 0) p.consignmentStock = p.consignmentStock.filter((c) => c !== entry);
    }
  }
  // Παλαιότερες αποστολές (πριν προστεθεί το πεδίο deliveryId) δεν έχουν ετικέτα στις κινήσεις τους —
  // fallback στο ταίριασμα κατάστημα + ακριβές timestamp δημιουργίας της αποστολής.
  db.stockMovements = (db.stockMovements || []).filter((m) => {
    if (m.deliveryId) return m.deliveryId !== delivery.id;
    return !(m.ref === delivery.storeId && m.createdAt === delivery.createdAt);
  });
}

export async function PUT(request, { params }) {
  const body = await request.json();
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({ productId: it.productId, quantity: Number(it.quantity || 0), unitPrice: it.unitPrice != null && it.unitPrice !== "" ? Number(it.unitPrice) : null }))
    .filter((it) => it.productId && it.quantity > 0);

  if (items.length === 0) return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });

  const db = readDB();
  const delivery = (db.consignmentDeliveries || []).find((d) => d.id === params.id);
  if (!delivery) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  const store = (db.consignmentStores || []).find((s) => s.id === delivery.storeId);
  if (!store) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  reverseDelivery(db, delivery);

  const resolved = [];
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (!p) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
    if (Number(p.stock || 0) < it.quantity) {
      return NextResponse.json({ error: "errors.insufficientStock" }, { status: 400 });
    }
    resolved.push({ product: p, quantity: it.quantity, unitPrice: it.unitPrice });
  }

  const deliveryItems = [];
  for (const { product: p, quantity: qty, unitPrice } of resolved) {
    p.stock = Math.round((Number(p.stock || 0) - qty) * 1000) / 1000;
    p.consignmentStock = p.consignmentStock || [];
    const entry = p.consignmentStock.find((c) => c.storeId === delivery.storeId);
    if (entry) entry.quantity = Math.round((Number(entry.quantity || 0) + qty) * 1000) / 1000;
    else p.consignmentStock.push({ storeId: delivery.storeId, quantity: qty });

    db.stockMovements.unshift({
      id: uid(),
      productId: p.id,
      productName: p.name,
      type: "out",
      quantity: qty,
      reason: serverT(db.settings.language, "consignment.reasonSent", { store: store.name }),
      ref: delivery.storeId,
      deliveryId: delivery.id,
      date: delivery.date,
      createdAt: new Date().toISOString(),
    });

    deliveryItems.push({ productId: p.id, productName: p.name, unit: p.unit, quantity: qty, unitPrice: unitPrice != null ? unitPrice : (Number(p.retailPrice) || 0) });
  }

  delivery.items = deliveryItems;
  if (body.date) delivery.date = body.date;

  writeDB(db);
  return NextResponse.json({ ok: true, delivery });
}

export async function DELETE(request, { params }) {
  const db = readDB();
  const delivery = (db.consignmentDeliveries || []).find((d) => d.id === params.id);
  if (!delivery) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  reverseDelivery(db, delivery);
  db.consignmentDeliveries = (db.consignmentDeliveries || []).filter((d) => d.id !== params.id);

  writeDB(db);
  return NextResponse.json({ ok: true });
}
