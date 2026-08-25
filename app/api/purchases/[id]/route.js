import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { logActivity } from "@/lib/audit";
import { incrementWarehouseStocks } from "@/lib/stockHelpers";

export async function GET(_req, { params }) {
  const rec = (readDB().purchases || []).find((x) => x.id === params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PUT(request, { params }) {
  let patch = await request.json();
  const db = readDB();
  const po = db.purchases.find((x) => x.id === params.id);
  if (!po) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  // Παραλαβή: πρόσθεσε τα είδη με απόθεμα στην αποθήκη (μία φορά).
  // Αν σταλεί patch.items με receivedQty (λεπτομερής παραλαβή), χρησιμοποιείται αυτή η ποσότητα
  // αντί της αρχικά παραγγελθείσας — καλύπτει τις περιπτώσεις μερικής/διαφορετικής παραλαβής.
  let receivedTotalQty = 0;
  const justReceived = patch.status === "received" && !po.received;
  if (justReceived) {
    const receivingItems = patch.items || po.items || [];
    for (const it of receivingItems) {
      if (!it.productId) continue;
      const p = db.products.find((x) => x.id === it.productId);
      const qty = Number(it.receivedQty ?? it.quantity ?? 0);
      if (p && p.trackStock !== false && qty > 0) {
        p.stock = Math.round((Number(p.stock || 0) + qty) * 1000) / 1000;
        incrementWarehouseStocks(p, qty);
        receivedTotalQty += qty;
        db.stockMovements.unshift({
          id: uid(), productId: p.id, productName: p.name, type: "in",
          quantity: qty,
          reason: serverT(db.settings.language, "stock.reasonPurchase", { number: po.number }),
          ref: po.id, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
        });
      }
    }
    po.received = true;
  }

  // Χωρίς τιμές πλέον στις Παραγγελίες Αγοράς — δεν δημιουργείται πια αυτόματο Έξοδο κατά την
  // παραλαβή. Το πραγματικό κόστος καταχωρείται χειροκίνητα ως Έξοδο όταν έρθει το τιμολόγιο
  // του προμηθευτή (το συνημμένο τιμολόγιο μένει πάνω στην ίδια την Παραγγελία, για αναφορά).
  // Αναδιαμόρφωση στο ίδιο καθαρό σχήμα με τη δημιουργία (POST) — χωρίς τυχόν κατάλοιπα
  // τιμής/ΦΠΑ/έκπτωσης από το LineItems όταν προστίθεται νέα γραμμή μέσω επεξεργασίας.
  if (patch.items) {
    patch = {
      ...patch,
      items: patch.items
        .filter((it) => it.description && Number(it.quantity) > 0)
        .map((it) => ({ productId: it.productId || null, description: it.description, quantity: Number(it.quantity), unit: it.unit || "pcs" })),
    };
  }
  Object.assign(po, patch, { updatedAt: new Date().toISOString() });

  writeDB(db);
  if (justReceived) await logActivity(request, "stock_receive", { number: po.number, totalQty: receivedTotalQty });
  return NextResponse.json(po);
}

export async function DELETE(_req, { params }) {
  const db = readDB();
  db.purchases = (db.purchases || []).filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
