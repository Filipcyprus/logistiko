import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  return NextResponse.json(readDB().purchases || []);
}

// Παραγγελίες αγοράς: ποια προϊόντα/ποσότητες θέλουμε να παραγγείλουμε, με τον κωδικό είδους του
// προμηθευτή και την τιμή αγοράς (χωρίς ΦΠΑ) ανά είδος — μόνο για αναφορά/σύγκριση. Το πραγματικό
// έξοδο εξακολουθεί να καταχωρείται χειροκίνητα ως Έξοδο όταν έρθει το τιμολόγιο του προμηθευτή.
export async function POST(request) {
  const body = await request.json();
  const db = readDB();

  const items = (body.items || []).filter((it) => it.description && Number(it.quantity) > 0);
  if (items.length === 0) return NextResponse.json({ error: "errors.needLine" }, { status: 400 });
  if (!body.supplierId) return NextResponse.json({ error: "errors.missingSupplier" }, { status: 400 });

  const seq = db.counters.purchase || 1;
  const number = `${db.settings.purchasePrefix || "PO-"}${String(seq).padStart(5, "0")}`;

  let supplierSnapshot = null;
  const sup = db.suppliers.find((x) => x.id === body.supplierId);
  if (sup) supplierSnapshot = { id: sup.id, name: sup.name, afm: sup.afm, address: sup.address, city: sup.city, phone: sup.phone, email: sup.email };

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
      code: it.code || "",
      // Τιμή αγοράς ανά είδος, ΧΩΡΙΣ ΦΠΑ — καθαρά για αναφορά/σύγκριση με το τιμολόγιο του
      // προμηθευτή όταν έρθει· δεν επηρεάζει κανέναν υπολογισμό ΦΠΑ/εξόδου εδώ.
      unitCost: it.unitCost != null ? Number(it.unitCost) : 0,
    })),
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
