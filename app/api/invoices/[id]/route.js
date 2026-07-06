import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

export async function GET(_req, { params }) {
  const db = readDB();
  const rec = db.invoices.find((x) => x.id === params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
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

  db.invoices = db.invoices.filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
