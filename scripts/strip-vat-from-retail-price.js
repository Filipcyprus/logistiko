// One-off: fixes prices left over from setting sales VAT to 0% (set-sale-vat.js).
//
// The problem: for any product with a retailPrice set, that number was originally computed
// as VAT-INCLUSIVE (net * (1 + oldRate/100)) — e.g. the Excel import's "LIANIKI ME VAT" column.
// The Till/invoice code derives the net price at sale time by dividing retailPrice by
// (1 + product.saleVatRate/100). Once saleVatRate was set to 0 for every product, that division
// became a no-op (divide by 1), so the OLD VAT-inclusive number kept being charged in full —
// customers paid exactly the same total, just relabeled as "0% VAT" instead of actually dropping
// by the VAT amount.
//
// The fix: using a backup taken BEFORE the VAT rates were zeroed (which still has each product's
// original saleVatRate), recompute retailPrice = oldRetailPrice / (1 + oldRate/100) — i.e. strip
// out the VAT that's baked into the stored number, so the price customers pay actually goes down.
// Products whose old rate was already 0% are left untouched (nothing to strip).
//
// Usage:  node scripts/strip-vat-from-retail-price.js <path-to-pre-change-backup.json>            (dry run)
//         node scripts/strip-vat-from-retail-price.js <path-to-pre-change-backup.json> --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");
const oldFileArg = process.argv.slice(2).find((a) => a !== "--apply");

if (!oldFileArg) {
  console.log("Usage: node scripts/strip-vat-from-retail-price.js <path-to-pre-change-backup.json> [--apply]");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const oldDb = JSON.parse(fs.readFileSync(oldFileArg, "utf-8"));
const oldById = new Map(oldDb.products.map((p) => [p.id, p]));

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const changes = [];
for (const p of db.products) {
  const retail = Number(p.retailPrice || 0);
  if (!(retail > 0)) continue;
  const old = oldById.get(p.id);
  const oldRate = Number(old?.saleVatRate || 0);
  if (!(oldRate > 0)) continue; // already VAT-free before — nothing baked in to strip
  const newRetail = round2(retail / (1 + oldRate / 100));
  if (newRetail === retail) continue;
  changes.push({ id: p.id, name: p.name, oldRate, oldRetail: retail, newRetail });
}

console.log(`Total products: ${db.products.length}`);
console.log(`Would correct ${changes.length} product(s) with a VAT-inclusive retail price. Sample:`);
changes.slice(0, 10).forEach((c) => console.log(` - ${c.name}: ${c.oldRetail} -> ${c.newRetail} (was ${c.oldRate}% VAT)`));
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
  if (c) p.retailPrice = c.newRetail;
}
fs.copyFileSync(DB_FILE, DB_FILE + ".before-strip-vat-retail");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-strip-vat-retail`);
