// One-off: assigns a department to every product that currently has none set — intended for
// the batch just created by the Excel import (which doesn't ask for a department), assuming
// every other pre-existing product already has one (barber/perfumes/printShop). Dry-run by
// default; shows exactly which products would change before writing anything.
//
// Usage:  node scripts/set-department-for-empty.js <department>            (dry run)
//         node scripts/set-department-for-empty.js <department> --apply
//
// Example: node scripts/set-department-for-empty.js printShop --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");
const department = process.argv.slice(2).find((a) => a !== "--apply");

if (!department) {
  console.log("Usage: node scripts/set-department-for-empty.js <department> [--apply]");
  console.log("Common values: printShop | barber | perfumes");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const targets = db.products.filter((p) => !p.department);

if (targets.length === 0) {
  console.log("No products with an empty department — nothing to do.");
  process.exit(0);
}

console.log(`Found ${targets.length} product(s) with no department set. Sample:`);
targets.slice(0, 10).forEach((p) => console.log(` - ${p.name}`));
if (targets.length > 10) console.log(` ...and ${targets.length - 10} more.`);
console.log(`\nWould set department -> "${department}" for all ${targets.length} of them.`);

if (!apply) {
  console.log("\nDry run only — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

for (const p of targets) p.department = department;
fs.copyFileSync(DB_FILE, DB_FILE + ".before-set-department");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-set-department`);
