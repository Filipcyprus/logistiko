import { uid } from "@/lib/db";
import { computeTotals } from "@/lib/format";
import { serverT } from "@/lib/i18n/server";

// Κοινή λογική καταχώρησης πώλησης σε κατάστημα παρακαταθήκης (consignment) — χρησιμοποιείται
// τόσο από τον ιδιοκτήτη/προσωπικό (app/api/consignment-sales) όσο και από το portal του ίδιου
// του καταστήματος (app/api/consignment-portal/sale). Μειώνει το απόθεμα ΣΤΟ κατάστημα και
// δημιουργεί απόδειξη εσόδου + εγγραφή consignmentSales. Μεταλλάσσει το db αντικείμενο· ο καλών
// είναι υπεύθυνος να καλέσει writeDB(db) μετά.
export function registerConsignmentSale(db, { storeId, productId, quantity, unitPrice, date, paymentMethod }) {
  const p = db.products.find((x) => x.id === productId);
  const store = db.consignmentStores.find((s) => s.id === storeId);
  if (!p || !store) return { error: "errors.notFound" };

  const qty = Number(quantity || 0);
  const price = Number(unitPrice || 0);
  if (qty <= 0) return { error: "errors.invalidInput" };

  p.consignmentStock = p.consignmentStock || [];
  const entry = p.consignmentStock.find((c) => c.storeId === storeId);
  const available = entry ? Number(entry.quantity || 0) : 0;
  if (available < qty) return { error: "errors.insufficientStock" };
  entry.quantity = Math.round((available - qty) * 1000) / 1000;

  const vatRate = Number(p.saleVatRate ?? p.vatRate ?? db.settings.vatRate ?? 19);
  const items = [{ productId: p.id, description: p.name, quantity: qty, unit: p.unit, unitPrice: price, vatRate, discount: 0 }];
  const totals = computeTotals(items);

  const seq = db.counters.receipt || 1;
  const prefix = db.settings.receiptPrefix || "";
  const series = db.settings.series || "A";
  const number = `${prefix}${series}-${String(seq).padStart(5, "0")}`;

  const invoice = {
    id: uid(),
    number,
    type: "apodeixi",
    series,
    shopName: store.name,
    aa: seq,
    date: date || new Date().toISOString().slice(0, 10),
    customerId: null,
    customer: null,
    items,
    net: totals.net,
    vat: totals.vat,
    total: totals.total,
    paymentMethod: paymentMethod || "cash",
    status: "paid",
    paidAmount: totals.total,
    notes: serverT(db.settings.language, "consignment.saleNote", { store: store.name }),
    sourceType: "consignment",
    sourceId: storeId,
    shiftId: null,
    createdAt: new Date().toISOString(),
  };
  db.invoices.unshift(invoice);
  db.counters.receipt = seq + 1;

  const sale = {
    id: uid(),
    storeId,
    storeName: store.name,
    productId: p.id,
    productName: p.name,
    quantity: qty,
    unitPrice: price,
    vatRate,
    total: totals.total,
    date: invoice.date,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    createdAt: new Date().toISOString(),
  };
  db.consignmentSales = db.consignmentSales || [];
  db.consignmentSales.unshift(sale);

  return { sale, invoice, product: p };
}

// Μειώνει το απόθεμα ανά τοποθεσία αποθήκης (FIFO στη σειρά καταχώρησης) όταν πουλιέται ένα προϊόν,
// ώστε η ανάλυση ανά τοποθεσία να παραμένει συγχρονισμένη με το συνολικό απόθεμα.
export function decrementWarehouseStocks(product, quantity) {
  let remaining = Number(quantity) || 0;
  if (!Array.isArray(product.warehouseStocks) || product.warehouseStocks.length === 0 || remaining <= 0) return;
  for (const ws of product.warehouseStocks) {
    if (remaining <= 0) break;
    const avail = Number(ws.stock) || 0;
    const take = Math.min(avail, remaining);
    ws.stock = Math.round((avail - take) * 1000) / 1000;
    remaining -= take;
  }
}

// Επιστρέφει απόθεμα στην πρώτη τοποθεσία (ακύρωση πώλησης, πιστωτικό κ.λπ.).
export function incrementWarehouseStocks(product, quantity) {
  const qty = Number(quantity) || 0;
  if (!Array.isArray(product.warehouseStocks) || product.warehouseStocks.length === 0 || qty <= 0) return;
  const first = product.warehouseStocks[0];
  first.stock = Math.round(((Number(first.stock) || 0) + qty) * 1000) / 1000;
}
