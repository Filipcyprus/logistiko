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
    vatRate: 19, // Κύπρος
    currency: "€",
    receiptPrefix: "RCT-",
    invoicePrefix: "INV-",
    creditPrefix: "CN-",
    quotePrefix: "QT-",
    orderPrefix: "ORD-",
    purchasePrefix: "PO-",
    series: "A",
    footerNote: "Thank you for choosing us!",
    // SMTP για αποστολή email (κενό = ανενεργό)
    mail: { host: "", port: 587, secure: false, user: "", pass: "", fromName: "", fromEmail: "" },
  },
  counters: {
    receipt: 1,
    invoice: 1,
    credit: 1,
    quote: 1,
    order: 1,
    purchase: 1,
    job: 1,
  },
  // Στάδια παραγωγής (τμήματα εργασιών) — παραμετροποιήσιμα
  stages: [
    { id: "s1", name: "To start", color: "slate", order: 0 },
    { id: "s2", name: "Design / Prepress", color: "violet", order: 1 },
    { id: "s3", name: "Printing", color: "blue", order: 2 },
    { id: "s4", name: "Finishing / Binding", color: "amber", order: 3 },
    { id: "s5", name: "Ready / Delivery", color: "emerald", order: 4 },
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
  quotes: [],
  orders: [],
  purchases: [],
  payments: [],
  expenses: [],
  stockMovements: [],
  activities: [],
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
  }
}

export function readDB() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const data = JSON.parse(raw);
    // Συγχώνευση με προεπιλογές ώστε νέα πεδία να μην λείπουν.
    return {
      ...DEFAULT_DATA,
      ...data,
      settings: {
        ...DEFAULT_DATA.settings,
        ...(data.settings || {}),
        mail: { ...DEFAULT_DATA.settings.mail, ...((data.settings || {}).mail || {}) },
      },
      counters: { ...DEFAULT_DATA.counters, ...(data.counters || {}) },
    };
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
