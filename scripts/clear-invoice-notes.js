// Καθαρισμός του πεδίου notes σε ένα ή περισσότερα παραστατικά (π.χ. αυτόματο σημείωμα
// "Replaces receipt ..." / "From tender ..." που δεν χρειάζεται πια στο τελικό έγγραφο).
// Δεν αγγίζει ποσά, πελάτη, είδη ή αρίθμηση — μόνο το πεδίο notes.
//
// Χρήση:  node scripts/clear-invoice-notes.js <number> [<number> ...]          (δοκιμή)
//         node scripts/clear-invoice-notes.js <number> [<number> ...] --apply (εφαρμογή)

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const numbers = args.filter((a) => a !== "--apply");

if (numbers.length === 0) {
  console.error("Usage: node scripts/clear-invoice-notes.js <number> [<number> ...] [--apply]");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const found = [];
const missing = [];

for (const number of numbers) {
  const doc = db.invoices.find((x) => x.number === number);
  if (!doc) { missing.push(number); continue; }
  found.push(doc);
  console.log(`${doc.number}: notes "${doc.notes || ""}"  ->  ""`);
}

if (missing.length) console.log(`\nΔεν βρέθηκαν: ${missing.join(", ")}`);
if (found.length === 0) process.exit(1);

if (!apply) {
  console.log("\nΔοκιμή μόνο — δεν γράφτηκε τίποτα. Τρέξε ξανά με --apply για εφαρμογή.");
  process.exit(0);
}

for (const doc of found) doc.notes = "";

fs.copyFileSync(DB_FILE, DB_FILE + ".before-clear-notes");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nΕφαρμόστηκε. Αντίγραφο ασφαλείας: data/db.json.before-clear-notes`);
