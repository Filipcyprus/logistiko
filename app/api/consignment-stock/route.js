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
    .map((it) => ({ productId: it.productId, quantity: Number(it.quantity || 0), testers: Math.max(Number(it.testers || 0), 0), unitPrice: it.unitPrice != null && it.unitPrice !== "" ? Number(it.unitPrice) : null }))
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
    // Επιτρέπεται και χωρίς επαρκές απόθεμα (π.χ. άρωμα που δεν έχει έρθει ακόμα): το απόθεμα αποθήκης
    // πάει αρνητικό μέχρι να γίνει παραλαβή, όπως ήδη γίνεται και σε άλλα προϊόντα.
    // Από τα μπουκάλια που στέλνονται, τα "testers" δεν πουλιούνται: μένουν ξεχωριστά στο κατάστημα για δοκιμή.
    resolved.push({ product: p, quantity: it.quantity, testers: Math.min(it.testers, it.quantity), unitPrice: it.unitPrice });
  }

  const deliveryId = uid();
  const deliveryItems = [];
  for (const { product: p, quantity: qty, testers, unitPrice } of resolved) {
    p.stock = Math.round((Number(p.stock || 0) - qty) * 1000) / 1000;
    p.consignmentStock = p.consignmentStock || [];
    const entry = p.consignmentStock.find((c) => c.storeId === storeId);
    const sellable = qty - testers;
    if (entry) {
      entry.quantity = Math.round((Number(entry.quantity || 0) + sellable) * 1000) / 1000;
      if (testers) entry.testers = Math.round((Number(entry.testers || 0) + testers) * 1000) / 1000;
    } else p.consignmentStock.push({ storeId, quantity: sellable, testers });

    db.stockMovements.unshift({
      id: uid(),
      productId: p.id,
      productName: p.name,
      type: "out",
      quantity: qty,
      reason: serverT(db.settings.language, "consignment.reasonSent", { store: store.name }),
      ref: storeId,
      deliveryId,
      date,
      createdAt: new Date().toISOString(),
    });

    // Τιμή σε αυτό το Δελτίο Αποστολής: αν δόθηκε δική της τιμή για αυτό το κατάστημα (διαφορετικά
    // καταστήματα μπορεί να έχουν διαφορετική τιμή για το ίδιο άρωμα), αλλιώς η γενική προτεινόμενη
    // τιμή πώλησης του προϊόντος τη στιγμή της παράδοσης — στιγμιότυπο, ώστε το τυπωμένο δελτίο να
    // μην αλλάζει αναδρομικά αν η τιμή του προϊόντος αλλάξει αργότερα.
    deliveryItems.push({ productId: p.id, productName: p.name, unit: p.unit, quantity: qty, testers, unitPrice: unitPrice != null ? unitPrice : (Number(p.retailPrice) || 0) });
  }

  const delivery = {
    id: deliveryId,
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
