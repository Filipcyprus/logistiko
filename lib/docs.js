import { readDB, writeDB, uid } from "@/lib/db";
import { computeTotals } from "@/lib/format";
import { serverT } from "@/lib/i18n/server";

// Κοινή λογική για Προσφορές (tenders) & Παραγγελίες (orders).
// Η ροή είναι κλιμακωτή: Προσφορά → (έγκριση) → Παραγγελία → (έγκριση) → Τιμολόγιο επί πιστώσει.
const CONFIG = {
  tenders: { counter: "tender", prefixKey: "tenderPrefix", statuses: ["draft", "sent", "approved", "rejected", "ordered"] },
  orders: { counter: "order", prefixKey: "orderPrefix", statuses: ["open", "approved", "in_progress", "ready", "delivered", "invoiced"] },
};

// Ο επόμενος διαθέσιμος αριθμός: το μικρότερο θετικό που δεν χρησιμοποιείται ήδη.
// Έτσι ένας αριθμός που ελευθερώθηκε με διαγραφή ξαναχρησιμοποιείται, αντί να μένει κενό.
// Επιτρεπτό ΜΟΝΟ εδώ: προσφορές/παραγγελίες δεν είναι φορολογικά παραστατικά — τα
// τιμολόγια/αποδείξεις αριθμούνται αλλού και παραμένουν αυστηρά διαδοχικά.
function nextAvailableSeq(docs) {
  const used = new Set(
    docs.map((d) => Number(d.aa)).filter((n) => Number.isInteger(n) && n > 0)
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export function listDocs(collection) {
  return readDB()[collection] || [];
}

export function getDoc(collection, id) {
  return (readDB()[collection] || []).find((x) => x.id === id) || null;
}

export function createDoc(collection, body) {
  const cfg = CONFIG[collection];
  const db = readDB();

  const items = (body.items || []).filter(
    (it) => it.description && Number(it.quantity) > 0
  );
  if (items.length === 0) {
    return { error: "errors.needLine" };
  }

  const seq = nextAvailableSeq(db[collection] || []);
  const prefix = db.settings[cfg.prefixKey] || "";
  const number = `${prefix}${String(seq).padStart(5, "0")}`;
  const totals = computeTotals(items);

  let customerSnapshot = null;
  if (body.customerId) {
    const c = db.customers.find((x) => x.id === body.customerId);
    if (c) {
      customerSnapshot = {
        id: c.id, name: c.name, afm: c.afm,
        address: c.address, city: c.city, phone: c.phone, email: c.email, profession: c.profession,
      };
    }
  }

  const doc = {
    id: uid(),
    number,
    aa: seq,
    date: body.date || new Date().toISOString().slice(0, 10),
    validUntil: body.validUntil || "",
    deliveryDate: body.deliveryDate || "",
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
    status: body.status || cfg.statuses[0],
    source: body.source || "manual", // manual | b2b
    notes: body.notes || "",
    // Προέλευση: από ποια προσφορά δημιουργήθηκε αυτή η παραγγελία (για ιχνηλασιμότητα).
    tenderId: body.tenderId || null,
    tenderNumber: body.tenderNumber || null,
    invoiceId: null,
    invoiceNumber: null,
    createdAt: new Date().toISOString(),
  };

  db[collection].unshift(doc);
  // Ο counter κρατιέται ενημερωμένος για συμβατότητα, αλλά η αρίθμηση προκύπτει πλέον
  // από τα υπάρχοντα έγγραφα (nextAvailableSeq), ώστε να καλύπτονται τα κενά διαγραφών.
  db.counters[cfg.counter] = Math.max(Number(db.counters[cfg.counter] || 1), seq + 1);
  writeDB(db);
  return doc;
}

export function updateDoc(collection, id, patch) {
  const db = readDB();
  const arr = db[collection] || [];
  const idx = arr.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  // Αν αλλάζουν γραμμές, ξαναϋπολόγισε σύνολα.
  if (patch.items) {
    const items = patch.items.filter((it) => it.description && Number(it.quantity) > 0);
    const t = computeTotals(items);
    patch = { ...patch, items, net: t.net, vat: t.vat, total: t.total };
  }
  arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
  writeDB(db);
  return arr[idx];
}

export function removeDoc(collection, id) {
  const db = readDB();
  db[collection] = (db[collection] || []).filter((x) => x.id !== id);
  writeDB(db);
  return true;
}
