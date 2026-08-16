import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { computeTotals } from "@/lib/format";
import { decrementWarehouseStocks, incrementWarehouseStocks } from "@/lib/stockHelpers";

export async function GET(_req, { params }) {
  const db = readDB();
  const rec = db.invoices.find((x) => x.id === params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

// Επεξεργασία πιστωτικού σημειώματος — μόνο credit notes επιτρέπονται.
export async function PUT(request, { params }) {
  const body = await request.json();
  const db = readDB();
  const inv = db.invoices.find((x) => x.id === params.id);
  if (!inv) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (inv.type !== "credit") return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });

  // Ενημέρωση γραμμών αν δόθησαν — με επανυπολογισμό συνόλων
  if (Array.isArray(body.items)) {
    const items = body.items.filter((it) => it.description && Number(it.quantity) > 0).map((it) => ({
      productId: it.productId || null,
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit || "pcs",
      unitPrice: Number(it.unitPrice || 0),
      vatRate: Number(it.vatRate || 0),
      discount: Number(it.discount || 0),
    }));
    const totals = computeTotals(items);
    inv.items = items;
    inv.net = totals.net;
    inv.vat = totals.vat;
    inv.total = totals.total;
  }

  // Ενημέρωση πληροφοριών πελάτη αν δόθησαν
  if (body.customer) {
    inv.customer = body.customer;
  }

  // Ενημέρωση σημειώσεων αν δόθησαν
  if (body.notes !== undefined) {
    inv.notes = body.notes;
  }

  inv.updatedAt = new Date().toISOString();
  writeDB(db);
  return NextResponse.json(inv);
}

// Ακύρωση/διαγραφή παραστατικού — αντιστρέφει την κίνηση αποθέματος.
export async function DELETE(_req, { params }) {
  const db = readDB();
  const inv = db.invoices.find((x) => x.id === params.id);
  if (!inv) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const isCredit = inv.type === "credit";
  // Κανονικό παραστατικό: είχε βγάλει στοκ → επιστροφή (+). Πιστωτικό: είχε προσθέσει στοκ → αφαίρεση (−).
  for (const it of inv.items || []) {
    if (!it.productId) continue;
    const p = db.products.find((x) => x.id === it.productId);
    if (p && p.trackStock !== false) {
      const delta = isCredit ? -Number(it.quantity) : Number(it.quantity);
      p.stock = Math.round((Number(p.stock || 0) + delta) * 1000) / 1000;
      if (delta > 0) incrementWarehouseStocks(p, delta);
      else decrementWarehouseStocks(p, -delta);
      db.stockMovements.unshift({
        id: uid(), productId: p.id, productName: p.name,
        type: isCredit ? "out" : "in", quantity: Number(it.quantity),
        reason: serverT(db.settings.language, "stock.reasonVoid", { number: inv.number }),
        ref: inv.id, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
      });
    }
  }

  // Αν διαγράφεται πιστωτικό, ξεκλείδωσε το αρχικό παραστατικό.
  if (isCredit && inv.relatedInvoiceId) {
    const orig = db.invoices.find((x) => x.id === inv.relatedInvoiceId);
    if (orig) { delete orig.creditNoteId; delete orig.creditNoteNumber; }
  }

  // Αν διαγράφεται το πιο πρόσφατο παραστατικό της σειράς του (δεν υπάρχει τίποτα μετά του),
  // επανάφερε τον μετρητή ώστε το επόμενο να πάρει τον ίδιο αριθμό — όχι κενό στην αρίθμηση.
  const counterKey = inv.type === "timologio" ? "invoice" : inv.type === "credit" ? "credit" : "receipt";
  if (Number(inv.aa) === (db.counters[counterKey] || 1) - 1) {
    db.counters[counterKey] = Number(inv.aa);
  }

  db.invoices = db.invoices.filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
