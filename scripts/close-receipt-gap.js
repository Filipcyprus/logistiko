// Κλείνει ΕΝΑ συγκεκριμένο κενό στην αρίθμηση αποδείξεων (π.χ. RCT-A-00327 διαγράφηκε):
// μετονομάζει κάθε επόμενη απόδειξη κατά μία θέση προς τα κάτω, ενημερώνει τα αντίστοιχα άρθρα
// του καθολικού (memoParams.number, που χρησιμοποιείται στην εμφάνιση του Ημερολογίου/Καθολικού),
// και μειώνει τον μετρητή ώστε η επόμενη ΝΕΑ απόδειξη να συνεχίσει σωστά.
//
// ΔΕΝ αγγίζει τίποτα άλλο: JE αριθμοί (JE-000XXX) μένουν όπως είναι — αυτοί είναι το πραγματικό
// αμετάβλητο ημερολόγιο· μόνο ο ΑΡΙΘΜΟΣ ΤΗΣ ΑΠΟΔΕΙΞΗΣ αλλάζει.
//
// Χρήση:  node scripts/close-receipt-gap.js <prefix> <missingNumber>              (δοκιμή)
//         node scripts/close-receipt-gap.js <prefix> <missingNumber> --apply      (εφαρμογή)
// π.χ.:   node scripts/close-receipt-gap.js RCT-A- 327 --apply

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(process.cwd(), "data", "db.json");

function main() {
  const [, , prefixArg, missingArg] = process.argv;
  const apply = process.argv.includes("--apply");
  if (!prefixArg || !missingArg) {
    console.error("Usage: node scripts/close-receipt-gap.js <prefix> <missingNumber> [--apply]");
    process.exit(1);
  }
  const missing = parseInt(missingArg, 10);
  const pad = missingArg.length; // κρατά το ίδιο πλήθος ψηφίων (π.χ. "327" -> 3, αλλά θέλουμε 5)
  const width = 5; // RCT-A-00327 -> 5ψήφιο αριθμό
  const fmt = (n) => `${prefixArg}${String(n).padStart(width, "0")}`;

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

  const withPrefix = db.invoices.filter((i) => String(i.number).startsWith(prefixArg));
  const numOf = (i) => parseInt(String(i.number).slice(prefixArg.length), 10);

  if (withPrefix.some((i) => numOf(i) === missing)) {
    console.error(`${fmt(missing)} still exists — nothing to close.`);
    process.exit(1);
  }

  // Όλα όσα είναι ΠΑΝΩ από το κενό μετακινούνται κατά μία θέση προς τα κάτω.
  const toShift = withPrefix.filter((i) => numOf(i) > missing).sort((a, b) => numOf(a) - numOf(b));
  if (toShift.length === 0) {
    console.log("Nothing after the gap — counter itself may just need adjusting.");
  }

  console.log(`Closing gap at ${fmt(missing)}:\n`);
  for (const inv of toShift) {
    const oldNumber = inv.number;
    const newNumber = fmt(numOf(inv) - 1);
    const je = db.journalEntries.find((e) => e.source?.type === "invoice" && e.source?.id === inv.id);
    console.log(`  ${oldNumber} -> ${newNumber}` + (je ? `   (${je.number} memo updated)` : "   (no linked journal entry)"));
    if (apply) {
      inv.number = newNumber;
      if (je && je.memoParams) je.memoParams.number = newNumber;
    }
  }

  const counterKey = Object.keys(db.counters).find((k) => (db.settings[`${k}Prefix`] || "") === prefixArg) || "receipt";
  const oldCounter = db.counters[counterKey];
  const newCounter = oldCounter - 1;
  console.log(`\ncounters.${counterKey}: ${oldCounter} -> ${newCounter}`);

  if (apply) {
    db.counters[counterKey] = newCounter;
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE);
    console.log("\ndb.json updated.");
  } else {
    console.log("\nDry run only — nothing written. Re-run with --apply to make the change.");
  }
}

main();
