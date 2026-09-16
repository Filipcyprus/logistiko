import { round2 } from "@/lib/posting";
import { isDebitNormal, sortByNumber } from "@/lib/accounts";

// Λογιστικές καταστάσεις — ΟΛΕΣ διαβάζουν αποκλειστικά από το Γενικό Καθολικό (db.journalEntries).
// Κανένα νούμερο δεν υπολογίζεται ξανά από τα παραστατικά: ό,τι δεν έχει καταχωριστεί ως άρθρο,
// δεν εμφανίζεται. Έτσι δουλεύει κάθε πραγματικό λογιστικό πρόγραμμα, και γι' αυτό Ισοζύγιο,
// Καθολικό, Αποτελέσματα και Ισολογισμός δεν μπορεί ΠΟΤΕ να διαφωνήσουν μεταξύ τους.
//
// Η ομαδοποίηση γίνεται με βάση τον ΤΥΠΟ του λογαριασμού (asset/liability/equity/income/expense),
// όχι με σταθερή λίστα — οπότε κάθε νέος λογαριασμός που φτιάχνει ο χρήστης μπαίνει αυτόματα στη
// σωστή κατάσταση, χωρίς αλλαγή κώδικα.

function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

// Αθροίσματα χρέωσης/πίστωσης ανά λογαριασμό για ένα διάστημα.
export function accountTotals(db, { from, to } = {}) {
  const totals = {};
  for (const e of db.journalEntries || []) {
    if (!inRange(e.date, from, to)) continue;
    for (const l of e.lines || []) {
      if (!totals[l.accountId]) totals[l.accountId] = { debit: 0, credit: 0 };
      totals[l.accountId].debit += l.debit || 0;
      totals[l.accountId].credit += l.credit || 0;
    }
  }
  for (const id of Object.keys(totals)) {
    totals[id].debit = round2(totals[id].debit);
    totals[id].credit = round2(totals[id].credit);
    totals[id].balance = round2(totals[id].debit - totals[id].credit);
  }
  return totals;
}

// Το "φυσικό" υπόλοιπο ενός λογαριασμού: θετικό όταν είναι στη φυσική του πλευρά.
// Ένα έσοδο με πιστωτικό υπόλοιπο 100 επιστρέφει +100 (όχι −100).
export function naturalBalance(account, rawBalance) {
  return isDebitNormal(account.type) ? round2(rawBalance) : round2(-rawBalance);
}

function accountRows(db, totals, types) {
  const rows = [];
  for (const acc of sortByNumber(db.accounts || [])) {
    if (types && !types.includes(acc.type)) continue;
    const t = totals[acc.id];
    if (!t) continue; // χωρίς κινήσεις → δεν εμφανίζεται
    rows.push({
      id: acc.id,
      number: acc.number,
      name: acc.name,
      nameKey: acc.nameKey,
      type: acc.type,
      debit: t.debit,
      credit: t.credit,
      balance: naturalBalance(acc, t.balance),
    });
  }
  return rows;
}

// ΙΣΟΖΥΓΙΟ — κάθε λογαριασμός με κινήσεις, με τα σύνολα χρέωσης/πίστωσης να ισοσκελίζουν πάντα.
export function trialBalance(db, asOf) {
  const totals = accountTotals(db, { to: asOf });
  const rows = accountRows(db, totals);
  // Στο ισοζύγιο κάθε λογαριασμός μπαίνει στη στήλη του ΠΡΑΓΜΑΤΙΚΟΥ του υπολοίπου, όχι της
  // φυσικής του πλευράς — έτσι φαίνεται αμέσως αν κάτι έχει "ανάποδο" υπόλοιπο.
  const lines = rows.map((r) => {
    const raw = round2(totals[r.id].balance);
    return { ...r, debitBalance: raw > 0 ? raw : 0, creditBalance: raw < 0 ? round2(-raw) : 0 };
  });
  const totalDebit = round2(lines.reduce((a, l) => a + l.debitBalance, 0));
  const totalCredit = round2(lines.reduce((a, l) => a + l.creditBalance, 0));
  return { asOf, lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
}

// ΑΠΟΤΕΛΕΣΜΑΤΑ ΧΡΗΣΗΣ — για διάστημα.
export function profitLoss(db, from, to) {
  const totals = accountTotals(db, { from, to });
  const income = accountRows(db, totals, ["income"]);
  const expenses = accountRows(db, totals, ["expense"]);

  const totalIncome = round2(income.reduce((a, r) => a + r.balance, 0));
  // Το κόστος πωληθέντων ξεχωρίζει, ώστε να βγαίνει μικτό κέρδος όπως σε κάθε κανονική κατάσταση.
  const cogsRows = expenses.filter((r) => r.nameKey === "coa.cogs");
  const opexRows = expenses.filter((r) => r.nameKey !== "coa.cogs");
  const totalCogs = round2(cogsRows.reduce((a, r) => a + r.balance, 0));
  const totalOpex = round2(opexRows.reduce((a, r) => a + r.balance, 0));
  const grossProfit = round2(totalIncome - totalCogs);
  const netIncome = round2(grossProfit - totalOpex);

  return { from, to, income, cogsRows, opexRows, totalIncome, totalCogs, grossProfit, totalOpex, netIncome };
}

// ΙΣΟΛΟΓΙΣΜΟΣ — "έως" μια ημερομηνία.
// Ενεργητικό = Υποχρεώσεις + Ίδια Κεφάλαια + Αποτέλεσμα Χρήσης. Ισχύει πάντα, γιατί το άθροισμα
// ΟΛΩΝ των υπολοίπων του καθολικού είναι εξ ορισμού μηδέν.
export function balanceSheet(db, asOf) {
  const totals = accountTotals(db, { to: asOf });
  const assets = accountRows(db, totals, ["asset"]);
  const liabilities = accountRows(db, totals, ["liability"]);
  const equity = accountRows(db, totals, ["equity"]);
  const income = accountRows(db, totals, ["income"]);
  const expenses = accountRows(db, totals, ["expense"]);

  const totalAssets = round2(assets.reduce((a, r) => a + r.balance, 0));
  const totalLiabilities = round2(liabilities.reduce((a, r) => a + r.balance, 0));
  const postedEquity = round2(equity.reduce((a, r) => a + r.balance, 0));
  const netIncome = round2(income.reduce((a, r) => a + r.balance, 0) - expenses.reduce((a, r) => a + r.balance, 0));
  const totalEquity = round2(postedEquity + netIncome);

  return {
    asOf,
    assets, liabilities, equity,
    totalAssets, totalLiabilities, postedEquity, netIncome, totalEquity,
    totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.005,
  };
}

// ΚΑΘΟΛΙΚΟ ενός λογαριασμού — κάθε κίνηση με τρέχον υπόλοιπο, ξεκινώντας από το υπόλοιπο που
// μεταφέρεται από πριν το "from".
export function generalLedger(db, accountId, from, to) {
  const account = (db.accounts || []).find((a) => a.id === accountId);
  if (!account) return null;

  let opening = 0;
  const rows = [];
  for (const e of db.journalEntries || []) {
    const lines = (e.lines || []).filter((l) => l.accountId === accountId);
    if (lines.length === 0) continue;
    const debit = round2(lines.reduce((a, l) => a + (l.debit || 0), 0));
    const credit = round2(lines.reduce((a, l) => a + (l.credit || 0), 0));
    if (from && e.date < from) {
      opening += debit - credit;
      continue;
    }
    if (to && e.date > to) continue;
    rows.push({
      entryId: e.id,
      number: e.number,
      date: e.date,
      createdAt: e.createdAt,
      memo: e.memo,
      memoKey: e.memoKey,
      memoParams: e.memoParams,
      sourceType: e.source?.type || "manual",
      itemLabel: lines.map((l) => l.itemLabel).filter(Boolean).join(", "),
      debit,
      credit,
    });
  }

  // Αύξουσα χρονολογική σειρά — το τρέχον υπόλοιπο πρέπει να "χτίζεται" από το παλιότερο προς το
  // νεότερο (το Ημερολόγιο αντίθετα δείχνει τα πιο πρόσφατα πρώτα).
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
  opening = round2(opening);
  let running = opening;
  for (const r of rows) {
    running = round2(running + r.debit - r.credit);
    r.balance = running;
  }

  return {
    account: { id: account.id, number: account.number, name: account.name, nameKey: account.nameKey, type: account.type },
    from, to,
    openingBalance: opening,
    rows,
    closingBalance: running,
    // Το φυσικό υπόλοιπο, για να φαίνεται σωστά το πρόσημο σε έσοδα/υποχρεώσεις.
    closingNatural: naturalBalance(account, running),
  };
}
