import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { computeTotals } from "@/lib/format";
import { serverT } from "@/lib/i18n/server";

export async function GET() {
  const db = readDB();
  return NextResponse.json(db.invoices);
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();

  const items = (body.items || []).filter(
    (it) => it.description && Number(it.quantity) > 0
  );
  if (items.length === 0) {
    return NextResponse.json(
      { error: "errors.needLine" },
      { status: 400 }
    );
  }

  // Τύπος: "apodeixi" (Απόδειξη) ή "timologio" (Τιμολόγιο)
  const type = body.type === "timologio" ? "timologio" : "apodeixi";
  const counterKey = type === "timologio" ? "invoice" : "receipt";
  const prefix =
    type === "timologio" ? db.settings.invoicePrefix : db.settings.receiptPrefix;
  const seq = db.counters[counterKey] || 1;
  const series = body.series || db.settings.series || "A";
  const number = `${prefix}${series}-${String(seq).padStart(5, "0")}`;

  const totals = computeTotals(items);

  // Στιγμιότυπο πελάτη (ώστε να μη χαλάει αν αλλάξουν τα στοιχεία αργότερα)
  let customerSnapshot = null;
  if (body.customerId) {
    const c = db.customers.find((x) => x.id === body.customerId);
    if (c) {
      customerSnapshot = {
        id: c.id,
        name: c.name,
        afm: c.afm,
        address: c.address,
        city: c.city,
        phone: c.phone,
        email: c.email,
        profession: c.profession,
      };
    }
  }

  const invoice = {
    id: uid(),
    number,
    type,
    series,
    aa: seq,
    date: body.date || new Date().toISOString().slice(0, 10),
    customerId: body.customerId || null,
    customer: customerSnapshot,
    items: items.map((it) => ({
      productId: it.productId || null,
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit || serverT(db.settings.language, "common.unit"),
      unitPrice: Number(it.unitPrice || 0),
      vatRate: Number(it.vatRate || 0),
      discount: Number(it.discount || 0),
    })),
    net: totals.net,
    vat: totals.vat,
    total: totals.total,
    paymentMethod: body.paymentMethod || "cash",
    status: body.status || "paid",
    paidAmount: body.status === "unpaid" ? 0 : totals.total,
    notes: body.notes || "",
    sourceType: body.sourceType || null, // από ποιο έγγραφο προήλθε
    sourceId: body.sourceId || null,
    shiftId: body.shiftId || null, // βάρδια ταμείου κατά την οποία έγινε η πώληση
    createdAt: new Date().toISOString(),
  };

  // Μείωση αποθέματος + κινήσεις αποθήκης
  for (const it of invoice.items) {
    if (!it.productId) continue;
    const p = db.products.find((x) => x.id === it.productId);
    if (p && p.trackStock !== false) {
      p.stock = Math.round((Number(p.stock || 0) - it.quantity) * 1000) / 1000;
      db.stockMovements.unshift({
        id: uid(),
        productId: p.id,
        productName: p.name,
        type: "out",
        quantity: it.quantity,
        reason: serverT(db.settings.language, "stock.reasonSale", { number }),
        ref: invoice.id,
        date: invoice.date,
        createdAt: new Date().toISOString(),
      });
    }
  }

  db.invoices.unshift(invoice);
  db.counters[counterKey] = seq + 1;

  // Αν προήλθε από προσφορά/παραγγελία, σημείωσέ το ως τιμολογημένο.
  if (body.sourceType && body.sourceId) {
    const coll = body.sourceType === "quote" ? db.quotes : db.orders;
    const src = coll?.find((x) => x.id === body.sourceId);
    if (src) {
      src.status = "invoiced";
      src.invoiceId = invoice.id;
      src.invoiceNumber = invoice.number;
    }
  }

  writeDB(db);
  return NextResponse.json(invoice, { status: 201 });
}
