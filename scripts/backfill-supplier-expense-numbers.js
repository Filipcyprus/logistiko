// One-off: assigns a unique sequential code/number to every EXISTING supplier and expense that
// doesn't have one yet (both fields are new — added when supplier/expense unique numbering was
// introduced). Oldest record (by createdAt, falling back to array order — expenses/suppliers were
// always unshifted on creation, so the LAST array item is the oldest) gets the lowest number, so
// numbering reads naturally in creation order. Safe to re-run — skips anything that already has
// a code/number. Always backs up data/db.json first.
//
// Usage: node scripts/backfill-supplier-expense-numbers.js [--apply]
// Dry-run by default (prints what it WOULD do); pass --apply to actually write.
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
db.counters = db.counters || {};

function assignNumbers(collection, field, prefixSetting, defaultPrefix, counterKey) {
  const items = db[collection] || [];
  const needsNumber = items.filter((x) => !x[field]);
  // Παλιότερο πρώτα: αν έχουν createdAt, ταξινόμηση με αυτό· αλλιώς αντιστροφή της σειράς
  // πίνακα (τα νεότερα μπαίνουν πάντα στην αρχή μέσω unshift, άρα το τέλος = παλιότερο).
  const ordered = [...needsNumber].sort((a, b) => {
    if (a.createdAt && b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return items.indexOf(b) - items.indexOf(a);
  });

  let seq = db.counters[counterKey] || 1;
  const prefix = (db.settings && db.settings[prefixSetting]) || defaultPrefix;
  for (const item of ordered) {
    const number = `${prefix}${String(seq).padStart(5, "0")}`;
    console.log(`${apply ? "SET" : "WOULD SET"} ${collection}/${item.id} ${field} = ${number}`);
    if (apply) item[field] = number;
    seq++;
  }
  if (apply) db.counters[counterKey] = seq;
  return ordered.length;
}

const supplierCount = assignNumbers("suppliers", "code", "supplierPrefix", "SUP-", "supplier");
const expenseCount = assignNumbers("expenses", "number", "expensePrefix", "EXP-", "expense");

console.log(`\n${supplierCount} suppliers, ${expenseCount} expenses ${apply ? "updated" : "would be updated"}.`);

if (apply) {
  fs.copyFileSync(DB_FILE, DB_FILE + ".before-backfill-numbers");
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
  console.log("Written to db.json (backup saved as db.json.before-backfill-numbers).");
} else {
  console.log("Dry run only — pass --apply to write.");
}
