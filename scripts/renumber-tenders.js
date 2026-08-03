// Ξαναριθμεί τις προσφορές διαδοχικά από το 1, με σειρά δημιουργίας, κλείνοντας κενά
// που άφησαν διαγραφές. Επιτρεπτό επειδή η προσφορά ΔΕΝ είναι φορολογικό παραστατικό
// (τα τιμολόγια/αποδείξεις δεν αγγίζονται ποτέ από αυτό το script).
//
// Ενημερώνει και τις παραγγελίες που δείχνουν στην παλιά αρίθμηση, ώστε να μη σπάσουν οι σύνδεσμοι.
//
// Χρήση:  node scripts/renumber-tenders.js          (δοκιμή — δείχνει τι θα άλλαζε)
//         node scripts/renumber-tenders.js --apply  (εκτέλεση)

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const apply = process.argv.includes("--apply");

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const tenders = db.tenders || [];

if (tenders.length === 0) {
  console.log("Δεν υπάρχουν προσφορές — καμία αλλαγή.");
  process.exit(0);
}

const prefix = db.settings?.tenderPrefix || "TND-";

// Παλαιότερη πρώτη, ώστε η αρίθμηση να ακολουθεί τη χρονική σειρά δημιουργίας.
const ordered = [...tenders].sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

const changes = [];
ordered.forEach((tender, idx) => {
  const seq = idx + 1;
  const number = `${prefix}${String(seq).padStart(5, "0")}`;
  if (tender.number !== number || Number(tender.aa) !== seq) {
    changes.push({ id: tender.id, from: tender.number, to: number });
    tender.aa = seq;
    tender.number = number;
  }
});

// Οι παραγγελίες κρατούν αντίγραφο του αριθμού προσφοράς — συγχρόνισέ το.
let orderRefsFixed = 0;
for (const order of db.orders || []) {
  if (!order.tenderId) continue;
  const tender = tenders.find((x) => x.id === order.tenderId);
  if (tender && order.tenderNumber !== tender.number) {
    order.tenderNumber = tender.number;
    orderRefsFixed++;
  }
}

db.counters = db.counters || {};
db.counters.tender = ordered.length + 1;

if (changes.length === 0 && orderRefsFixed === 0) {
  console.log("Η αρίθμηση είναι ήδη σωστή — καμία αλλαγή.");
  process.exit(0);
}

for (const c of changes) console.log(`${c.from}  ->  ${c.to}`);
if (orderRefsFixed) console.log(`Ενημερώθηκαν ${orderRefsFixed} παραπομπές παραγγελιών.`);

if (!apply) {
  console.log(`\nΔοκιμή μόνο — δεν γράφτηκε τίποτα. Τρέξε ξανά με --apply για εφαρμογή.`);
  process.exit(0);
}

fs.copyFileSync(DB_FILE, DB_FILE + ".before-renumber");
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
console.log(`\nΕφαρμόστηκε. Αντίγραφο ασφαλείας: data/db.json.before-renumber`);
