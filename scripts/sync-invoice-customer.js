// Invoices store a SNAPSHOT of the customer at issue time (see customerSnapshot in
// app/api/invoices/route.js) so editing a customer profile later never silently rewrites past
// fiscal documents. This script is for the deliberate case where you actually want one specific
// invoice's snapshot refreshed to match the current customer record (e.g. you fixed a typo or
// added missing details right after issuing it).
//
// Usage:  node scripts/sync-invoice-customer.js <INVOICE_NUMBER>          (dry run)
//         node scripts/sync-invoice-customer.js <INVOICE_NUMBER> --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");
const NUMBER = process.argv.slice(2).find((a) => a !== "--apply");

if (!NUMBER) {
  console.log("Usage: node scripts/sync-invoice-customer.js <INVOICE_NUMBER> [--apply]");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const inv = db.invoices.find((x) => x.number === NUMBER);
if (!inv) {
  console.log(`No invoice with number ${NUMBER} — aborting.`);
  process.exit(1);
}
if (!inv.customerId) {
  console.log(`${NUMBER} has no linked customer (free-text name) — nothing to sync.`);
  process.exit(1);
}
const c = db.customers.find((x) => x.id === inv.customerId);
if (!c) {
  console.log(`Linked customer ${inv.customerId} not found — aborting.`);
  process.exit(1);
}

const newSnapshot = {
  id: c.id, name: c.name, afm: c.afm,
  address: c.address, city: c.city, phone: c.phone, email: c.email, profession: c.profession,
};

console.log("Before:", JSON.stringify(inv.customer));
console.log("After: ", JSON.stringify(newSnapshot));

if (JSON.stringify(inv.customer) === JSON.stringify(newSnapshot)) {
  console.log("\nAlready in sync — no change.");
  process.exit(0);
}

if (!apply) {
  console.log("\nDry run only — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

inv.customer = newSnapshot;
fs.copyFileSync(DB_FILE, DB_FILE + ".before-sync-invoice-customer");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nApplied. Backup saved at ${DB_FILE}.before-sync-invoice-customer`);
