// One-off: closes a gap left in a document numbering sequence (invoices, receipts, tenders,
// orders, purchase orders, ...) when one was created then deleted, but wasn't the most-recent one
// at delete time (delete routes only roll back the counter for the most-recent doc in its
// series). Only ever run this for a gap where the document(s) above the gap have NOT been
// sent/shared yet — renumbering something already handed to a customer/supplier/accountant would
// make the system disagree with the copy they have.
//
// Renumbers ONE existing document down by one slot, closing the gap directly below it, and
// patches every other literal reference to its old number found anywhere in db.json (source
// tender/order invoiceNumber snapshot, payment/receipt relatedNumber, stock movement history,
// notes text, etc.) via a plain string replace on the raw JSON — safe because the numbers are
// specific enough (e.g. "INV-A-00006") not to collide with anything else in the file.
//
// Usage:  node scripts/fix-invoice-gap.js <OLD_NUMBER> <NEW_NUMBER> <NEW_COUNTER_VALUE> [NEW_AA]  (dry run)
//         node scripts/fix-invoice-gap.js <OLD_NUMBER> <NEW_NUMBER> <NEW_COUNTER_VALUE> [NEW_AA] --apply
//
// NEW_AA only applies to documents that carry a sequential "aa" field (invoices/tenders/orders) —
// omit it for ones that don't (e.g. purchase orders, which are identified by number alone).
//
// Example (invoice, has aa):   node scripts/fix-invoice-gap.js INV-A-00006 INV-A-00005 6 5 --apply
// Example (purchase, no aa):   node scripts/fix-invoice-gap.js PO-00003 PO-00002 3 --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const args = process.argv.slice(2).filter((a) => a !== "--apply");
const apply = process.argv.includes("--apply");
const [OLD_NUM, NEW_NUM, NEW_COUNTER, NEW_AA] = args;

if (!OLD_NUM || !NEW_NUM || !NEW_COUNTER) {
  console.log("Usage: node scripts/fix-invoice-gap.js <OLD_NUMBER> <NEW_NUMBER> <NEW_COUNTER_VALUE> [NEW_AA] [--apply]");
  process.exit(1);
}

const raw = fs.readFileSync(DB_FILE, "utf-8");
const escaped = OLD_NUM.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
const occurrences = (raw.match(new RegExp(escaped, "g")) || []).length;

if (occurrences === 0) {
  console.log(`No occurrences of ${OLD_NUM} found — nothing to do.`);
  process.exit(0);
}
console.log(`Found ${occurrences} occurrence(s) of ${OLD_NUM} in db.json — will replace with ${NEW_NUM}.`);

const patchedRaw = raw.split(OLD_NUM).join(NEW_NUM);
const db = JSON.parse(patchedRaw);

// Ψάξε σε όλες τις αριθμοδοτημένες συλλογές — όχι μόνο τιμολόγια — ώστε το ίδιο script να
// καλύπτει και παραγγελίες αγοράς, προσφορές, παραγγελίες κ.λπ.
const COLLECTIONS = ["invoices", "tenders", "orders", "purchases"];
let doc = null;
for (const coll of COLLECTIONS) {
  const found = (db[coll] || []).find((x) => x.number === NEW_NUM);
  if (found) { doc = found; break; }
}
if (!doc) {
  console.log(`Could not find any document with number ${NEW_NUM} after the patch — aborting, nothing written.`);
  process.exit(1);
}
if (NEW_AA !== undefined) doc.aa = Number(NEW_AA);

const PREFIX_TO_COUNTER = {
  [db.settings?.receiptPrefix || "RCT-"]: "receipt",
  [db.settings?.invoicePrefix || "INV-"]: "invoice",
  [db.settings?.creditPrefix || "CN-"]: "credit",
  [db.settings?.tenderPrefix || "TND-"]: "tender",
  [db.settings?.orderPrefix || "ORD-"]: "order",
  [db.settings?.purchasePrefix || "PO-"]: "purchase",
};
const matchedPrefix = Object.keys(PREFIX_TO_COUNTER).find((p) => NEW_NUM.startsWith(p));
const counterKey = PREFIX_TO_COUNTER[matchedPrefix] || "invoice";
db.counters = db.counters || {};
db.counters[counterKey] = Number(NEW_COUNTER);

console.log(`${doc.id}: number -> ${doc.number}${NEW_AA !== undefined ? `, aa -> ${doc.aa}` : ""}, counters.${counterKey} -> ${db.counters[counterKey]}`);

if (!apply) {
  console.log("\nDry run only — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

fs.copyFileSync(DB_FILE, DB_FILE + ".before-fix-invoice-gap");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-fix-invoice-gap`);
