import fs from "fs";
import path from "path";

// Τοπική αποθήκευση δεδομένων σε ένα αρχείο JSON.
// Απλό, αξιόπιστο, χωρίς εξωτερικές υπηρεσίες ή native modules.

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_DATA = {
  settings: {
    language: "en", // "en" | "el" — γλώσσα διεπαφής, προεπιλογή Αγγλικά
    companyName: "My Print Shop",
    afm: "", // VAT registration number (Κύπρος)
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    logo: "",
    bankName: "",
    bankAccountHolder: "",
    bankIban: "",
    bankSwift: "",
    bankConfirmationEmail: "",
    vatRate: 19, // Κύπρος
    currency: "€",
    receiptPrefix: "RCT-",
    invoicePrefix: "INV-",
    creditPrefix: "CN-",
    tenderPrefix: "TND-",
    orderPrefix: "ORD-",
    purchasePrefix: "PO-",
    series: "A",
    footerNote: "Thank you for choosing us!",
    // SMTP για αποστολή email (κενό = ανενεργό)
    mail: { host: "", port: 587, secure: false, user: "", pass: "", fromName: "", fromEmail: "" },
    // Θερμικός εκτυπωτής αποδείξεων μέσω QZ Tray (τοπικό πρόγραμμα-γέφυρα στον υπολογιστή του
    // ταμείου) — name πρέπει να ταιριάζει ΑΚΡΙΒΩΣ με το όνομα του εκτυπωτή στα Windows.
    receiptPrinter: { enabled: false, name: "", widthMm: 80, host: "", openCashDrawer: false }, // host: κενό = ίδιος υπολογιστής, αλλιώς IP του υπολογιστή του εκτυπωτή
  },
  counters: {
    receipt: 1,
    invoice: 1,
    credit: 1,
    tender: 1,
    order: 1,
    purchase: 1,
    job: 1,
  },
  // Στάδια παραγωγής (τμήματα εργασιών) — παραμετροποιήσιμα
  stages: [
    { id: "s0", name: "Waiting for price/offer", color: "rose", order: 0 },
    { id: "s1", name: "To start", color: "slate", order: 1 },
    { id: "s2", name: "In production", color: "blue", order: 2 },
    { id: "s5", name: "Ready / Delivery", color: "emerald", order: 3 },
  ],
  jobs: [],
  users: [], // { id, username, passwordHash, role: "owner" | "manager" | "cashier", canDiscount }
  heldSales: [], // { id, createdAt, label, customerId, cart: [...] }
  shifts: [], // { id, openedAt, openedBy, openingFloat, status, closedAt, closedBy, countedCash, expectedCash, difference }
  activityLog: [], // { id, createdAt, username, role, action, details }
  categories: [],
  customers: [],
  suppliers: [],
  products: [],
  invoices: [],
  tenders: [],
  orders: [],
  purchases: [],
  payments: [],
  expenses: [],
  stockMovements: [],
  activities: [],
  consignmentStores: [], // { id, name, address, phone, contact, notes }
  consignmentSales: [], // { id, storeId, storeName, productId, productName, quantity, unitPrice, vatRate, total, date, invoiceId, invoiceNumber }
  consignmentOrders: [], // { id, storeId, storeName, items: [{productId, productName, quantity}], status: "pending"|"fulfilled", notes, createdAt }
  consignmentDeliveries: [], // { id, storeId, storeName, date, items: [{productId, productName, unit, quantity}], createdAt }
  partnerShops: [], // { id, name, contact, phone, email, notes, portalToken, portalEnabled }
  // Λίστα προϊόντων προς παραγγελία — προσωρινή "λίστα αγορών", ξεχωριστή από τις Παραγγελίες
  // Αγοράς: εδώ απλά μαζεύονται προϊόντα που χρειάζονται αναπλήρωση μέχρι να αποφασιστεί πότε/από
  // ποιον προμηθευτή θα παραγγελθούν. Όταν είναι έτοιμη, μετατρέπεται σε Παραγγελία(ές) Αγοράς.
  reorderList: [], // { id, productId, productName, unit, quantity, addedAt }
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
  }
}

// Cache στη μνήμη: αποφεύγει επανάληψη ανάγνωσης/parse ολόκληρου του αρχείου
// σε κάθε request όταν το αρχείο δεν έχει αλλάξει στον δίσκο (mtime).
let cache = null; // { mtimeMs, data }

function mergeDefaults(data) {
  return {
    ...DEFAULT_DATA,
    ...data,
    settings: {
      ...DEFAULT_DATA.settings,
      ...(data.settings || {}),
      mail: { ...DEFAULT_DATA.settings.mail, ...((data.settings || {}).mail || {}) },
      receiptPrinter: { ...DEFAULT_DATA.settings.receiptPrinter, ...((data.settings || {}).receiptPrinter || {}) },
    },
    counters: { ...DEFAULT_DATA.counters, ...(data.counters || {}) },
  };
}

export function readDB() {
  ensureFile();
  try {
    const mtimeMs = fs.statSync(DB_FILE).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) {
      return structuredClone(cache.data);
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const merged = mergeDefaults(JSON.parse(raw));
    cache = { mtimeMs, data: merged };
    return structuredClone(merged);
  } catch (e) {
    console.error("Σφάλμα ανάγνωσης βάσης:", e);
    return structuredClone(DEFAULT_DATA);
  }
}

export function writeDB(data) {
  ensureFile();
  // Εγγραφή σε προσωρινό αρχείο και μετονομασία (ασφαλέστερη εγγραφή).
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, DB_FILE);
  cache = { mtimeMs: fs.statSync(DB_FILE).mtimeMs, data };
  return data;
}

export function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

// --- Γενικές λειτουργίες συλλογών ---
export function list(collection) {
  const db = readDB();
  return db[collection] || [];
}

export function getById(collection, id) {
  const db = readDB();
  return (db[collection] || []).find((x) => x.id === id) || null;
}

export function insert(collection, obj) {
  const db = readDB();
  const record = { id: uid(), createdAt: new Date().toISOString(), ...obj };
  db[collection] = [record, ...(db[collection] || [])];
  writeDB(db);
  return record;
}

export function update(collection, id, patch) {
  const db = readDB();
  const arr = db[collection] || [];
  const idx = arr.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
  db[collection] = arr;
  writeDB(db);
  return arr[idx];
}

export function remove(collection, id) {
  const db = readDB();
  const arr = db[collection] || [];
  db[collection] = arr.filter((x) => x.id !== id);
  writeDB(db);
  return true;
}
