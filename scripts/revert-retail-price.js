// One-off: reverts retailPrice back to whatever it was in a given backup file, per product id.
// Built to undo strip-vat-from-retail-price.js — turns out the intended behavior when sales VAT
// goes to 0% is to KEEP the same customer-facing price (e.g. "4 with 19% VAT" stays "4 with 0%
// VAT"), not to strip the VAT portion out and lower it. Only touches retailPrice — nothing else.
//
// Usage:  node scripts/revert-retail-price.js <path-to-backup.json>            (dry run)
//         node scripts/revert-retail-price.js <path-to-backup.json> --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");
const backupFileArg = process.argv.slice(2).find((a) => a !== "--apply");

if (!backupFileArg) {
  console.log("Usage: node scripts/revert-retail-price.js <path-to-backup.json> [--apply]");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const backupDb = JSON.parse(fs.readFileSync(backupFileArg, "utf-8"));
const backupById = new Map(backupDb.products.map((p) => [p.id, p]));

const changes = [];
for (const p of db.products) {
  const b = backupById.get(p.id);
  if (!b) continue;
  const current = p.retailPrice == null ? null : Number(p.retailPrice);
  const original = b.retailPrice == null ? null : Number(b.retailPrice);
  if (current === original) continue;
  changes.push({ id: p.id, name: p.name, current, original });
}

console.log(`Total products: ${db.products.length}`);
console.log(`Would revert retailPrice on ${changes.length} product(s). Sample:`);
changes.slice(0, 10).forEach((c) => console.log(` - ${c.name}: ${c.current} -> ${c.original}`));
if (changes.length > 10) console.log(` ...and ${changes.length - 10} more.`);

if (changes.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

if (!apply) {
  console.log("\nDry run only — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

const byId = new Map(changes.map((c) => [c.id, c]));
for (const p of db.products) {
  const c = byId.get(p.id);
  if (c) p.retailPrice = c.original;
}
fs.copyFileSync(DB_FILE, DB_FILE + ".before-revert-retail-price");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-revert-retail-price`);
