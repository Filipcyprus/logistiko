// One-off: sets saleVatRate (the VAT rate charged to customers, used by Till/invoices/receipts)
// to a given percentage on every product. Does NOT touch vatRate (the purchase/cost-side VAT
// field) — that's a separate concept. Dry-run by default; shows a breakdown of current rates
// before writing anything.
//
// Usage:  node scripts/set-sale-vat.js <rate>            (dry run)
//         node scripts/set-sale-vat.js <rate> --apply
//
// Example: node scripts/set-sale-vat.js 0 --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");
const rateArg = process.argv.slice(2).find((a) => a !== "--apply");
const rate = Number(rateArg);

if (rateArg == null || Number.isNaN(rate)) {
  console.log("Usage: node scripts/set-sale-vat.js <rate> [--apply]");
  console.log("Example: node scripts/set-sale-vat.js 0 --apply");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

const before = {};
for (const p of db.products) before[p.saleVatRate] = (before[p.saleVatRate] || 0) + 1;
console.log(`Total products: ${db.products.length}`);
console.log("Current saleVatRate breakdown:", before);

const targets = db.products.filter((p) => Number(p.saleVatRate) !== rate);
console.log(`\nWould change ${targets.length} product(s) to saleVatRate = ${rate}.`);
if (targets.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

if (!apply) {
  console.log("\nDry run only — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

for (const p of targets) p.saleVatRate = rate;
fs.copyFileSync(DB_FILE, DB_FILE + ".before-set-sale-vat");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-set-sale-vat`);
