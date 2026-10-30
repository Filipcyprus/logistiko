import { uid } from "@/lib/db";
import { computeTotals } from "@/lib/format";
import { serverT } from "@/lib/i18n/server";
import { bonusFor, soldBottlesOf } from "@/lib/consignmentBonus";

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

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Ο πελάτης (καρτέλα) που αντιστοιχεί σε ένα κατάστημα παρακαταθήκης — ώστε το τιμολόγιο προς το κατάστημα να
// εμφανίζεται στο υπόλοιπο/τις εισπράξεις πελατών όπως κάθε άλλο τιμολόγιο. Βρίσκεται με ΑΦΜ ή όνομα,
// αλλιώς δημιουργείται μία φορά από τα στοιχεία του καταστήματος.
export function ensureStoreCustomer(db, store) {
  let c = store.customerId ? db.customers.find((x) => x.id === store.customerId) : null;
  const afm = String(store.afm || "").trim();
  const name = String(store.legalName || store.name || "").trim();
  if (!c && afm) c = db.customers.find((x) => String(x.afm || "").trim() === afm);
  if (!c) c = db.customers.find((x) => String(x.name || "").trim().toLowerCase() === name.toLowerCase());
  if (!c) {
    c = {
      id: uid(), createdAt: new Date().toISOString(), name, afm, profession: "", address: store.address || "", city: store.city || "",
      phone: store.phone || "", email: store.email || "", priceListName: "", defaultDiscount: 0, creditDays: 0, notes: "",
    };
    db.customers.unshift(c);
  }
  store.customerId = c.id;
  return c;
}

// Ο προμηθευτής (καρτέλα) που αντιστοιχεί σε ένα κατάστημα — για την προμήθεια που του οφείλουμε.
export function ensureStoreSupplier(db, store) {
  db.suppliers = db.suppliers || [];
  let s = store.supplierId ? db.suppliers.find((x) => x.id === store.supplierId) : null;
  const afm = String(store.afm || "").trim();
  const name = String(store.legalName || store.name || "").trim();
  if (!s && afm) s = db.suppliers.find((x) => String(x.afm || "").trim() === afm);
  if (!s) s = db.suppliers.find((x) => String(x.name || "").trim().toLowerCase() === name.toLowerCase());
  if (!s) {
    const seq = db.counters.supplier || 1;
    s = {
      id: uid(), code: `${db.settings.supplierPrefix || "SUP-"}${String(seq).padStart(5, "0")}`, name, afm, profession: "",
      address: store.address || "", city: store.city || "", phone: store.phone || "", email: store.email || "", notes: "",
      consignmentDefault: false, createdAt: new Date().toISOString(),
    };
    db.suppliers.unshift(s);
    db.counters.supplier = seq + 1;
  }
  store.supplierId = s.id;
  return s;
}

// Πώληση ενός ή περισσότερων αρωμάτων σε κατάστημα παρακαταθήκης — μειώνει το απόθεμα ΣΤΟ κατάστημα.
//   invoice: false → απόδειξη εισπραγμένη αμέσως (όπως πριν).
//   invoice: true  → ΤΙΜΟΛΟΓΙΟ προς το κατάστημα (απλήρωτο): οι γραμμές στην τιμή πώλησης + γραμμή "Commission (X%)"
//                    με αρνητικό ποσό = η προμήθεια που κρατά το κατάστημα. Το υπόλοιπο είναι αυτό που μας οφείλει.
// Μεταλλάσσει το db· ο καλών κάνει την καταχώριση στο Καθολικό και writeDB.
export function registerConsignmentSales(db, { storeId, lines, date, invoice, holdMoney, commissionPercent, paymentMethod, paymentSplit }) {
  const store = db.consignmentStores.find((s) => s.id === storeId);
  if (!store) return { error: "errors.notFound" };

  const resolved = [];
  const used = {};
  for (const l of Array.isArray(lines) ? lines : []) {
    const qty = Number(l.quantity || 0);
    if (!l.productId || qty <= 0) continue;
    const p = db.products.find((x) => x.id === l.productId);
    if (!p) return { error: "errors.notFound" };
    const entry = (p.consignmentStock || []).find((c) => c.storeId === storeId);
    used[p.id] = (used[p.id] || 0) + qty;
    if (!entry || Number(entry.quantity || 0) < used[p.id]) return { error: "errors.insufficientStock" };
    resolved.push({ p, entry, qty, price: Number(l.unitPrice || 0) });
  }
  if (resolved.length === 0) return { error: "errors.invalidInput" };

  const vatOf = (p) => (db.settings.notVatRegistered ? 0 : Number(p.saleVatRate ?? p.vatRate ?? db.settings.vatRate ?? 19));
  const items = resolved.map(({ p, qty, price }) => ({
    productId: p.id, description: p.name, quantity: qty, unit: p.unit || "pcs", unitPrice: price, vatRate: vatOf(p), discount: 0,
  }));

  const basePct = invoice || holdMoney ? Math.min(Math.max(Number(commissionPercent) || 0, 0), 100) : 0;
  // Μπόνους: με τα μπουκάλια που έχει πουλήσει ήδη το κατάστημα + αυτά της τωρινής πώλησης. Ισχύει από την πώληση
  // που συμπληρώνει τον στόχο και μετά.
  const soldNow = resolved.reduce((a, r) => a + r.qty, 0);
  const level = invoice || holdMoney ? bonusFor(store.bonusLevels, soldBottlesOf(db.consignmentSales, storeId) + soldNow) : null;
  const bonusPct = level ? level.extraPercent : 0;
  const pct = Math.min(basePct + bonusPct, 100);
  const gross = r2(items.reduce((a, it) => a + it.quantity * it.unitPrice, 0));
  let commissionAmount = 0;
  if ((invoice || holdMoney) && pct > 0) commissionAmount = r2((gross * pct) / 100);
  if (invoice && pct > 0) {
    items.push({
      productId: null, description: `Commission (${pct}%)`, quantity: 1, unit: "pcs", unitPrice: -commissionAmount,
      vatRate: Math.max(...items.map((it) => it.vatRate)), discount: 0,
    });
  }
  const totals = computeTotals(items);

  // Πώς εισπράχθηκαν τα λεφτά: μετρητά και/ή κάρτα. Αν δόθηκαν και τα δύο, το άθροισμα πρέπει να βγάζει το σύνολο.
  // Ελέγχεται ΠΡΙΝ αλλάξει οποιοδήποτε απόθεμα.
  let method = invoice ? (paymentMethod || "bank") : (paymentMethod || "cash");
  let split = null;
  if (!invoice && Array.isArray(paymentSplit)) {
    const parts = paymentSplit
      .map((s) => ({ method: s.method === "card" ? "card" : "cash", amount: r2(s.amount) }))
      .filter((s) => s.amount > 0);
    if (parts.length) {
      const sum = r2(parts.reduce((a, s) => a + s.amount, 0));
      if (Math.abs(sum - totals.total) > 0.011) return { error: "errors.invalidInput" };
      if (parts.length === 1) method = parts[0].method;
      else {
        parts[parts.length - 1].amount = r2(totals.total - parts.slice(0, -1).reduce((a, s) => a + s.amount, 0));
        split = parts;
        method = [...parts].sort((a, b) => b.amount - a.amount)[0].method; // για αναφορές που βλέπουν ένα μόνο τρόπο
      }
    }
  }

  for (const { entry, qty } of resolved) entry.quantity = Math.round((Number(entry.quantity || 0) - qty) * 1000) / 1000;

  const type = invoice ? "timologio" : "apodeixi";
  const counterKey = invoice ? "invoice" : "receipt";
  const seq = db.counters[counterKey] || 1;
  const prefix = (invoice ? db.settings.invoicePrefix : db.settings.receiptPrefix) || "";
  const series = db.settings.series || "A";
  const number = `${prefix}${series}-${String(seq).padStart(5, "0")}`;

  let customerSnapshot = null;
  if (invoice) {
    const c = ensureStoreCustomer(db, store);
    customerSnapshot = { id: c.id, name: c.name, afm: c.afm, address: c.address, city: c.city, phone: c.phone, email: c.email, profession: c.profession };
    store.commissionPercent = basePct; // την επόμενη φορά προτείνεται το ίδιο ποσοστό (χωρίς το μπόνους)
  } else if (holdMoney) {
    // Τα λεφτά τα έχουμε ήδη: η πώληση καταγράφεται ως απόδειξη εισπραγμένη· το ποσό του καταστήματος βγαίνει ξεχωριστά
    // ως τιμολόγιο προμήθειας (από εμάς προς το κατάστημα).
    store.commissionPercent = basePct;
  }
  const cur = db.settings.currency || "€";

  const doc = {
    id: uid(),
    number,
    type,
    isPaymentReceipt: false,
    series,
    shopName: store.name,
    aa: seq,
    date: date || new Date().toISOString().slice(0, 10),
    customerId: invoice ? customerSnapshot.id : null,
    customer: customerSnapshot,
    items,
    net: totals.net,
    vat: totals.vat,
    total: totals.total,
    invoiceDiscount: 0,
    subtotal: totals.net,
    paymentMethod: method,
    paymentSplit: split || undefined,
    status: invoice ? "unpaid" : "paid",
    paidAmount: invoice ? 0 : totals.total,
    notes: serverT(db.settings.language, "consignment.saleNote", { store: store.name }),
    sourceType: "consignment",
    sourceId: storeId,
    shiftId: null,
    createdAt: new Date().toISOString(),
  };
  db.invoices.unshift(doc);
  db.counters[counterKey] = seq + 1;

  // Προμήθεια που χρωστάμε στο κατάστημα = έξοδο "επί πιστώσεως" προς το κατάστημα ως προμηθευτή, ώστε να φαίνεται
  // το υπόλοιπο που του οφείλουμε και να πληρωθεί αργότερα από τις Πληρωμές Προμηθευτών.
  let expense = null;
  let commissionInvoice = null;
  if (holdMoney && commissionAmount > 0) {
    const sup = ensureStoreSupplier(db, store);
    const eseq = db.counters.expense || 1;
    expense = {
      id: uid(), number: `${db.settings.expensePrefix || "EXP-"}${String(eseq).padStart(5, "0")}`, date: doc.date, category: "general",
      description: `Commission to ${sup.name} (${pct}% of ${gross.toFixed(2)} ${cur} sales, ${doc.number})`,
      supplier: sup.name, supplierId: sup.id, net: commissionAmount, vat: 0, vatRate: 0, vatLines: null, amount: commissionAmount,
      paymentMethod: "cash", paidAmount: commissionAmount, paid: true, accountId: null, attachment: null, notes: "", createdAt: new Date().toISOString(),
    };
    // Η προμήθεια δίνεται στο κατάστημα αμέσως (μετρητά), όχι αργότερα.
    db.expenses = [expense, ...(db.expenses || [])];
    db.counters.expense = eseq + 1;
    doc.commissionExpenseId = expense.id;

    // Το τιμολόγιο προς το κατάστημα, μόνο για το ποσό που του δίνουμε. Δεν είναι πώληση (δεν μπαίνει στα έσοδα): το
    // Καθολικό το καλύπτει το έξοδο παραπάνω. Η γραμμή ανά άρωμα δείχνει από ποιες πωλήσεις προκύπτει.
    const lines = resolved.map(({ p, qty, price }) => ({
      description: `${qty} × ${p.name} (sales ${r2(qty * price).toFixed(2)} ${cur})`,
      amount: r2((qty * price * pct) / 100),
    }));
    lines[lines.length - 1].amount = r2(lines[lines.length - 1].amount + (commissionAmount - r2(lines.reduce((a, l) => a + l.amount, 0))));
    const cseq = db.counters.commissionInvoice || 1;
    commissionInvoice = {
      id: uid(), number: `COM-${series}-${String(cseq).padStart(5, "0")}`, aa: cseq, series, date: doc.date,
      storeId, storeName: store.name, supplierId: sup.id, expenseId: expense.id, expenseNumber: expense.number,
      receiptId: doc.id, receiptNumber: doc.number, percent: pct, basePercent: basePct, bonusPercent: bonusPct,
      salesTotal: gross, amount: commissionAmount, lines, createdAt: new Date().toISOString(),
    };
    db.commissionInvoices = [commissionInvoice, ...(db.commissionInvoices || [])];
    db.counters.commissionInvoice = cseq + 1;
    doc.commissionInvoiceId = commissionInvoice.id;
    doc.commissionInvoiceNumber = commissionInvoice.number;
  }

  db.consignmentSales = db.consignmentSales || [];
  const sales = resolved.map(({ p, qty, price }) => {
    const sale = {
      id: uid(), storeId, storeName: store.name, productId: p.id, productName: p.name, quantity: qty, unitPrice: price,
      vatRate: vatOf(p), total: r2(qty * price * (1 + vatOf(p) / 100)), date: doc.date, invoiceId: doc.id, invoiceNumber: doc.number,
      commissionInvoiceId: commissionInvoice?.id, commissionInvoiceNumber: commissionInvoice?.number,
      commissionPercent: pct || undefined, createdAt: new Date().toISOString(),
    };
    db.consignmentSales.unshift(sale);
    return sale;
  });

  return { sales, invoice: doc, expense, commissionInvoice, commissionAmount, gross, bonusPercent: bonusPct, soldTotal: soldBottlesOf(db.consignmentSales, storeId) };
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
