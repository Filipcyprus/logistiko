// One-off: closes a gap left in the invoice/receipt numbering sequence when a document was
// created then deleted, but wasn't the most-recent one at delete time (the delete route only
// rolls back the counter for the most-recent doc in its series — see app/api/invoices/[id]/route.js).
// Only ever run this for a gap where the document(s) above the gap have NOT been sent/shared yet —
// renumbering something already handed to a customer/accountant would make the system disagree
// with the copy they have.
//
// Renumbers ONE existing document down by one slot, closing the gap directly below it, and
// patches every other literal reference to its old number found anywhere in db.json (source
// tender/order invoiceNumber snapshot, payment/receipt relatedNumber, stock movement history,
// notes text, etc.) via a plain string replace on the raw JSON — safe because the numbers are
// specific enough (e.g. "INV-A-00006") not to collide with anything else in the file.
//
// Usage:  node scripts/fix-invoice-gap.js <OLD_NUMBER> <NEW_NUMBER> <NEW_AA> <NEW_COUNTER_VALUE>  (dry run)
//         node scripts/fix-invoice-gap.js <OLD_NUMBER> <NEW_NUMBER> <NEW_AA> <NEW_COUNTER_VALUE> --apply
//
// Example: node scripts/fix-invoice-gap.js INV-A-00006 INV-A-00005 5 6 --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const args = process.argv.slice(2).filter((a) => a !== "--apply");
const apply = process.argv.includes("--apply");
const [OLD_NUM, NEW_NUM, NEW_AA, NEW_COUNTER] = args;

if (!OLD_NUM || !NEW_NUM || !NEW_AA || !NEW_COUNTER) {
  console.log("Usage: node scripts/fix-invoice-gap.js <OLD_NUMBER> <NEW_NUMBER> <NEW_AA> <NEW_COUNTER_VALUE> [--apply]");
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

const which = ["invoices", "tenders", "orders"];
let inv = null;
for (const coll of which) {
  const found = (db[coll] || []).find((x) => x.number === NEW_NUM);
  if (found && coll === "invoices") inv = found;
}
if (!inv) {
  console.log(`Could not find an invoice with number ${NEW_NUM} after the patch — aborting, nothing written.`);
  process.exit(1);
}
inv.aa = Number(NEW_AA);
db.counters = db.counters || {};
const counterKey = NEW_NUM.startsWith(db.settings?.receiptPrefix || "RCT-") ? "receipt" : "invoice";
db.counters[counterKey] = Number(NEW_COUNTER);

console.log(`${inv.id}: aa -> ${inv.aa}, counters.${counterKey} -> ${db.counters[counterKey]}`);

if (!apply) {
  console.log("\nDry run only — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

fs.copyFileSync(DB_FILE, DB_FILE + ".before-fix-invoice-gap");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-fix-invoice-gap`);
