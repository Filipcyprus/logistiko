import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { computeTotals } from "@/lib/format";
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

  // Παραλαβή = πραγματικό κόστος: καταχώρησε αυτόματα το ποσό ως Έξοδο (μία φορά ανά PO),
  // με το τιμολόγιο του προμηθευτή (αν έχει επισυναφθεί) κολλημένο πάνω του για τον λογιστή.
  if (justReceived && !po.expenseId) {
    const expense = {
      id: uid(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      category: "purchaseOrder",
      description: serverT(db.settings.language, "expenses.autoPODescription", { number: po.number }),
      supplier: po.supplier?.name || "",
      net: po.net,
      vat: po.vat,
      amount: po.total,
      paymentMethod: "bank",
      notes: "",
      purchaseOrderId: po.id,
      attachment: po.attachment || null,
    };
    db.expenses = [expense, ...(db.expenses || [])];
    po.expenseId = expense.id;
  }

  if (patch.items) {
    const items = patch.items.filter((it) => it.description && Number(it.quantity) > 0);
    const tott = computeTotals(items);
    patch = { ...patch, items, net: tott.net, vat: tott.vat, total: tott.total };
  }
  Object.assign(po, patch, { updatedAt: new Date().toISOString() });

  // Αν το τιμολόγιο επισυνάπτεται/αφαιρείται αφού έχει ήδη δημιουργηθεί το αυτόματο έξοδο,
  // κράτησε το ίδιο αρχείο συγχρονισμένο και στις δύο εγγραφές.
  if (patch.attachment !== undefined && po.expenseId) {
    const linkedExpense = (db.expenses || []).find((e) => e.id === po.expenseId);
    if (linkedExpense) linkedExpense.attachment = patch.attachment;
  }

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
