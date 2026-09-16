import { uid } from "@/lib/db";
import { SEED_ACCOUNTS, findBySystemKey, findById, defaultSubtypeFor, normalizeAccounts } from "@/lib/accounts";

// Μηχανή Καταχώρισης (Posting Engine) — ό,τι μπαίνει στο Γενικό Καθολικό περνάει ΜΟΝΟ από εδώ.
//
// Βασικοί κανόνες, ίδιοι με κάθε σοβαρό λογιστικό πρόγραμμα:
//   1. Κάθε άρθρο ΠΡΕΠΕΙ να ισοσκελίζει (σύνολο χρεώσεων = σύνολο πιστώσεων).
//   2. Κάθε άρθρο παίρνει μοναδικό, συνεχόμενο αριθμό (JE-000001) που δεν ξαναδίνεται ποτέ.
//   3. Κλειδωμένη περίοδος (settings.lockedThrough) = δεν μπαίνει/δεν φεύγει τίποτα μέχρι
//      εκείνη την ημερομηνία. Διόρθωση γίνεται μόνο με ΑΝΤΙΛΟΓΙΣΜΟ σε ανοιχτή περίοδο.
//   4. Τα υπόλοιπα ΔΕΝ αποθηκεύονται πουθενά — προκύπτουν πάντα από το άθροισμα των άρθρων,
//      οπότε δεν μπορούν να "ξεσυγχρονιστούν" από τις κινήσεις.

export function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

// Δημιουργεί το αρχικό λογιστικό σχέδιο την πρώτη φορά. Idempotent: ό,τι systemKey λείπει
// προστίθεται, ό,τι υπάρχει μένει ως έχει (δεν πατάει πάνω σε μετονομασίες του χρήστη).
// Επιστρέφει πόσοι λογαριασμοί προστέθηκαν ή διορθώθηκαν — 0 σημαίνει "τίποτα να αποθηκευτεί".
export function ensureAccounts(db) {
  db.accounts = db.accounts || [];
  // Πρώτα οι παλιοί λογαριασμοί παίρνουν ό,τι τους λείπει (systemKey, υποκατηγορία), αλλιώς
  // παρακάτω θα δημιουργούνταν διπλοί λογαριασμοί με τον ίδιο αριθμό.
  let changed = normalizeAccounts(db);
  for (const seed of SEED_ACCOUNTS) {
    const existing = seed.systemKey
      ? db.accounts.find((a) => a.systemKey === seed.systemKey)
      : db.accounts.find((a) => a.number === seed.number);
    if (existing) continue;
    db.accounts.push({
      id: uid(),
      number: seed.number,
      name: "", // κενό = χρησιμοποιείται η μεταφρασμένη ονομασία του nameKey
      nameKey: seed.nameKey,
      systemKey: seed.systemKey || null,
      type: seed.type,
      subtype: seed.subtype || defaultSubtypeFor(seed.type),
      isSystem: !!seed.systemKey,
      active: true,
      createdAt: new Date().toISOString(),
    });
    changed++;
  }
  return changed;
}

export function isPeriodLocked(db, date) {
  const lockedThrough = db.settings?.lockedThrough;
  if (!lockedThrough) return false;
  return String(date) <= String(lockedThrough);
}

export function findEntriesBySource(db, sourceType, sourceId) {
  return (db.journalEntries || []).filter((e) => e.source?.type === sourceType && e.source?.id === sourceId);
}

// Μετατρέπει τις γραμμές ενός άρθρου σε τελική μορφή: λύνει systemKey → accountId, πετάει τις
// μηδενικές γραμμές, στρογγυλοποιεί. Ρίχνει καθαρό σφάλμα αν λείπει λογαριασμός.
function resolveLines(db, lines) {
  const resolved = [];
  for (const l of lines || []) {
    const debit = round2(l.debit);
    const credit = round2(l.credit);
    if (!debit && !credit) continue;
    let account = null;
    if (l.accountId) account = findById(db.accounts, l.accountId);
    else if (l.systemKey) account = findBySystemKey(db.accounts, l.systemKey);
    if (!account) {
      throw new Error(`Δεν βρέθηκε λογαριασμός για την εγγραφή (accountId=${l.accountId || "-"}, systemKey=${l.systemKey || "-"})`);
    }
    resolved.push({
      accountId: account.id,
      debit,
      credit,
      memo: l.memo || "",
      itemLabel: l.itemLabel || "",
    });
  }
  return resolved;
}

// Καταχωρίζει ένα άρθρο. Πετάει σφάλμα αν δεν ισοσκελίζει ή αν η περίοδος είναι κλειδωμένη.
export function postEntry(db, { date, memo, memoKey, memoParams, source, lines, createdBy }) {
  db.journalEntries = db.journalEntries || [];
  ensureAccounts(db);

  const entryDate = date || new Date().toISOString().slice(0, 10);
  if (isPeriodLocked(db, entryDate)) {
    const err = new Error("errors.periodLocked");
    err.code = "PERIOD_LOCKED";
    throw err;
  }

  const resolvedLines = resolveLines(db, lines);
  if (resolvedLines.length === 0) return null; // τίποτα να καταχωριστεί (π.χ. μηδενικά ποσά)

  const totalDebit = round2(resolvedLines.reduce((a, l) => a + l.debit, 0));
  const totalCredit = round2(resolvedLines.reduce((a, l) => a + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    const err = new Error(`errors.entryNotBalanced`);
    err.code = "NOT_BALANCED";
    err.details = { totalDebit, totalCredit };
    throw err;
  }

  const seq = db.counters.journalEntry || 1;
  const number = `${db.settings?.journalPrefix || "JE-"}${String(seq).padStart(6, "0")}`;

  const entry = {
    id: uid(),
    number,
    date: entryDate,
    memo: memo || "",
    memoKey: memoKey || null,
    memoParams: memoParams || null,
    source: source || { type: "manual", id: null },
    lines: resolvedLines,
    totalDebit,
    totalCredit,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
    reversalOf: null,
    reversedBy: null,
  };

  db.journalEntries.unshift(entry);
  db.counters.journalEntry = seq + 1;
  return entry;
}

// Αντιλογισμός: δημιουργεί ΝΕΟ άρθρο με χρεώσεις/πιστώσεις αντεστραμμένες. Το αρχικό άρθρο δεν
// αγγίζεται ποτέ — απλώς σημειώνεται ότι αντιλογίστηκε (έτσι δουλεύει η αμετάβλητη λογιστική).
export function reverseEntry(db, entryId, { date, createdBy } = {}) {
  const original = (db.journalEntries || []).find((e) => e.id === entryId);
  if (!original) {
    const err = new Error("errors.notFound");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (original.reversedBy) {
    const err = new Error("errors.alreadyReversed");
    err.code = "ALREADY_REVERSED";
    throw err;
  }

  const reversal = postEntry(db, {
    date: date || new Date().toISOString().slice(0, 10),
    memoKey: "journal.descReversal",
    memoParams: { number: original.number },
    source: { type: "reversal", id: original.id },
    lines: original.lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, memo: l.memo })),
    createdBy,
  });

  original.reversedBy = reversal.id;
  reversal.reversalOf = original.id;
  return reversal;
}

// Αφαίρεση των άρθρων ενός παραστατικού (π.χ. όταν διαγράφεται ένα τιμολόγιο). Επιτρέπεται μόνο
// σε ΑΝΟΙΧΤΗ περίοδο — αλλιώς η σωστή κίνηση είναι αντιλογισμός, όχι διαγραφή.
export function removeEntriesBySource(db, sourceType, sourceId) {
  const existing = findEntriesBySource(db, sourceType, sourceId);
  for (const e of existing) {
    if (isPeriodLocked(db, e.date)) {
      const err = new Error("errors.periodLocked");
      err.code = "PERIOD_LOCKED";
      throw err;
    }
  }
  if (existing.length === 0) return 0;
  const ids = new Set(existing.map((e) => e.id));
  db.journalEntries = (db.journalEntries || []).filter((e) => !ids.has(e.id));
  return existing.length;
}

// Ξανακαταχωρίζει ένα παραστατικό: σβήνει τα παλιά του άρθρα και βάζει τα νέα. Χρησιμοποιείται
// όταν επεξεργάζεται κανείς ένα ήδη καταχωρισμένο παραστατικό σε ανοιχτή περίοδο.
export function repostSource(db, sourceType, sourceId, entryInput) {
  removeEntriesBySource(db, sourceType, sourceId);
  if (!entryInput) return null;
  return postEntry(db, { ...entryInput, source: { type: sourceType, id: sourceId } });
}
