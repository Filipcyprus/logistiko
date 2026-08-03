// Διόρθωση ημερομηνίας συγκεκριμένου παραστατικού (π.χ. λάθος ημερομηνία κατά τη δημιουργία).
// Δεν αγγίζει ποσά, πελάτη, είδη ή αρίθμηση — μόνο το πεδίο date.
//
// Χρήση:  node scripts/fix-invoice-date.js <number> <YYYY-MM-DD>          (δοκιμή)
//         node scripts/fix-invoice-date.js <number> <YYYY-MM-DD> --apply (εφαρμογή)

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const [, , number, newDate, flag] = process.argv;
const apply = flag === "--apply";

if (!number || !/^\d{4}-\d{2}-\d{2}$/.test(newDate || "")) {
  console.error("Usage: node scripts/fix-invoice-date.js <number> <YYYY-MM-DD> [--apply]");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const doc = db.invoices.find((x) => x.number === number);
if (!doc) {
  console.error(`Δεν βρέθηκε παραστατικό με αριθμό ${number}`);
  process.exit(1);
}

console.log(`${doc.number}: date ${doc.date}  ->  ${newDate}`);

if (!apply) {
  console.log("\nΔοκιμή μόνο — δεν γράφτηκε τίποτα. Τρέξε ξανά με --apply για εφαρμογή.");
  process.exit(0);
}

doc.date = newDate;

fs.copyFileSync(DB_FILE, DB_FILE + ".before-date-fix");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nΕφαρμόστηκε. Αντίγραφο ασφαλείας: data/db.json.before-date-fix`);
