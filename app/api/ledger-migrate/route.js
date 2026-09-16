import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { ensureAccounts, postEntry, findEntriesBySource } from "@/lib/posting";
import {
  entryForInvoice, entryForExpense, entryForPayment,
  entryForPurchaseReceipt, entryForSupplierPayment,
} from "@/lib/postingRules";

// Μεταφορά ιστορικού στο Γενικό Καθολικό — καταχωρίζει άρθρα για ΟΛΑ τα παραστατικά που
// δημιουργήθηκαν πριν υπάρξει το καθολικό. Idempotent: ό,τι έχει ήδη άρθρο, παραλείπεται, οπότε
// μπορεί να ξανατρέξει με ασφάλεια.
//
// GET  → τι θα γινόταν (dry run)
// POST → εκτέλεση
//
// Σημείωση ακρίβειας: το κόστος πωληθέντων των παλιών πωλήσεων υπολογίζεται με το ΣΗΜΕΡΙΝΟ κόστος
// κάθε προϊόντος (δεν κρατιόταν ιστορικό κόστους) — για παλιές πωλήσεις προϊόντων που άλλαξαν τιμή
// αγοράς, το κόστος είναι προσέγγιση.
function collectSources(db) {
  const jobs = [];

  for (const inv of db.invoices || []) {
    jobs.push({ type: "invoice", id: inv.id, date: inv.date, build: () => entryForInvoice(db, inv) });
  }
  for (const e of db.expenses || []) {
    jobs.push({ type: "expense", id: e.id, date: e.date, build: () => entryForExpense(db, e) });
  }
  for (const p of db.payments || []) {
    jobs.push({ type: "payment", id: p.id, date: p.date, build: () => entryForPayment(db, p) });
  }
  for (const po of db.purchases || []) {
    if (!po.received) continue;
    const date = (po.receivedAt || po.updatedAt || po.date || "").slice(0, 10);
    jobs.push({ type: "purchase", id: po.id, date, build: () => entryForPurchaseReceipt(db, po) });
  }
  for (const sp of db.supplierPayments || []) {
    jobs.push({ type: "supplierPayment", id: sp.id, date: sp.date, build: () => entryForSupplierPayment(db, sp) });
  }

  // Χρονολογική σειρά, ώστε οι αριθμοί άρθρων (JE-000001…) να βγαίνουν με τη σειρά που έγιναν.
  jobs.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return jobs;
}

export async function GET() {
  const db = readDB();
  ensureAccounts(db);
  const jobs = collectSources(db);

  let toPost = 0, alreadyPosted = 0, nothingToPost = 0;
  for (const job of jobs) {
    if (findEntriesBySource(db, job.type, job.id).length > 0) { alreadyPosted++; continue; }
    if (!job.build()) { nothingToPost++; continue; }
    toPost++;
  }

  return NextResponse.json({
    dryRun: true,
    totalSources: jobs.length,
    toPost, alreadyPosted, nothingToPost,
    existingEntries: (db.journalEntries || []).length,
  });
}

export async function POST() {
  const db = readDB();
  ensureAccounts(db);

  // Η μεταφορά αγνοεί το κλείδωμα περιόδου — καταχωρίζει ιστορικά γεγονότα που ΕΧΟΥΝ ήδη συμβεί.
  const lockedThrough = db.settings.lockedThrough;
  db.settings.lockedThrough = "";

  const jobs = collectSources(db);
  let posted = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const job of jobs) {
    if (findEntriesBySource(db, job.type, job.id).length > 0) { skipped++; continue; }
    let input;
    try {
      input = job.build();
    } catch (e) {
      failed++; errors.push({ type: job.type, id: job.id, error: String(e.message || e) });
      continue;
    }
    if (!input) { skipped++; continue; }
    try {
      postEntry(db, { ...input, source: { type: job.type, id: job.id } });
      posted++;
    } catch (e) {
      failed++; errors.push({ type: job.type, id: job.id, error: String(e.message || e) });
    }
  }

  db.settings.lockedThrough = lockedThrough;
  writeDB(db);

  return NextResponse.json({
    posted, skipped, failed,
    errors: errors.slice(0, 20),
    totalEntries: (db.journalEntries || []).length,
  });
}
