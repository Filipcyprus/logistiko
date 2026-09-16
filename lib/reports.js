import { round2 } from "@/lib/posting";
import { isDebitNormal, sortByNumber, BALANCE_SHEET_GROUPS, cashFlowSection, normalizeAccounts } from "@/lib/accounts";

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

// ΙΣΟΛΟΓΙΣΜΟΣ ΜΕ ΟΜΑΔΕΣ — Κυκλοφορούν / Πάγιο / Βραχυπρόθεσμες / Μακροπρόθεσμες, όπως σε κάθε
// κανονική λογιστική κατάσταση (αντί για μία επίπεδη λίστα λογαριασμών).
export function balanceSheetGrouped(db, asOf) {
  normalizeAccounts(db); // οι ομάδες στηρίζονται στην υποκατηγορία — μη την αφήσεις κενή
  const totals = accountTotals(db, { to: asOf });
  const base = balanceSheet(db, asOf);
  const bySubtype = (subtypes, types) =>
    accountRows(db, totals, types).filter((r) => {
      const acc = (db.accounts || []).find((a) => a.id === r.id);
      return subtypes.includes(acc?.subtype);
    });

  const groups = BALANCE_SHEET_GROUPS.map((g) => {
    const types = g.side === "assets" ? ["asset"] : g.side === "liabilities" ? ["liability"] : ["equity"];
    const rows = bySubtype(g.subtypes, types);
    return { key: g.key, side: g.side, rows, total: round2(rows.reduce((a, r) => a + r.balance, 0)) };
  }).filter((g) => g.rows.length > 0 || g.key === "equity");

  return { ...base, groups };
}

// ΚΑΤΑΣΤΑΣΗ ΤΑΜΕΙΑΚΩΝ ΡΟΩΝ (άμεση μέθοδος) — η τρίτη βασική λογιστική κατάσταση.
// Για κάθε άρθρο που κινεί Ταμείο/Τράπεζα, η ροή κατατάσσεται ανάλογα με το ΤΙ βρίσκεται
// απέναντι: έσοδα/έξοδα/πελάτες/προμηθευτές → Λειτουργικές, πάγια → Επενδυτικές,
// κεφάλαιο/δάνεια → Χρηματοδοτικές.
export function cashFlow(db, from, to) {
  normalizeAccounts(db); // "τι είναι ταμείο" και σε ποια κατηγορία μπαίνει κάθε ροή: υποκατηγορία
  const accById = new Map((db.accounts || []).map((a) => [a.id, a]));
  const isCashAcc = (id) => accById.get(id)?.subtype === "bank";
  const isPl = (a) => a?.type === "income" || a?.type === "expense";

  const sections = { operating: [], investing: [], financing: [] };
  let opening = 0;

  for (const e of db.journalEntries || []) {
    const cashLines = (e.lines || []).filter((l) => isCashAcc(l.accountId));
    if (cashLines.length === 0) continue;
    const net = round2(cashLines.reduce((a, l) => a + (l.debit || 0) - (l.credit || 0), 0));
    if (!net) continue;

    if (from && e.date < from) { opening += net; continue; }
    if (to && e.date > to) continue;

    // Από ΠΟΥ ήρθαν ή ΠΟΥ πήγαν τα λεφτά. Μετράνε μόνο οι γραμμές στην ΑΝΤΙΘΕΤΗ πλευρά από το
    // ταμείο, ΑΦΟΥ πρώτα φύγουν τα ζευγάρια που αλληλοεξουδετερώνονται μέσα στο ίδιο άρθρο.
    //
    // Μια πώληση τοις μετρητοίς είναι: Χρ. Ταμείο / Πίστ. Πωλήσεις  +  Χρ. Κόστος / Πίστ. Απόθεμα.
    // Το δεύτερο ζευγάρι είναι ισόποσο και δεν αγγίζει καθόλου χρήμα — αν μείνει μέσα, σε κάθε
    // πώληση κάτω του κόστους το Απόθεμα βγαίνει μεγαλύτερο από τις Πωλήσεις και η εισροή
    // χρεώνεται λάθος στο Απόθεμα. Τα ισόποσα ζευγάρια είναι δομικά (το κόστος πωληθέντων ΙΣΟΥΤΑΙ
    // πάντα με τη μείωση αποθέματος), οπότε η εξουδετέρωση κατά ποσό είναι ασφαλής.
    const others = (e.lines || []).filter((l) => !isCashAcc(l.accountId));
    const amount = (l) => round2((net > 0 ? l.debit : l.credit) || 0); // ίδια πλευρά με το ταμείο
    const offsetting = others.map(amount).filter((a) => a > 0);

    // Όταν η τιμή πώλησης ΙΣΟΥΤΑΙ με το κόστος, και οι Πωλήσεις και το Απόθεμα ταιριάζουν στο ίδιο
    // ποσό. Ψάχνουμε πρώτα τους λογαριασμούς ισολογισμού, ώστε να εξουδετερωθεί το Απόθεμα και να
    // μείνουν οι Πωλήσεις — η εισροή από μια πώληση είναι πάντα το έσοδο, ποτέ το απόθεμα.
    const balanceSheetFirst = others
      .map((l, i) => ({ l, i }))
      .sort((a, b) => Number(isPl(accById.get(a.l.accountId))) - Number(isPl(accById.get(b.l.accountId))) || a.i - b.i);

    const facing = [];
    for (const { l } of balanceSheetFirst) {
      const value = round2((net > 0 ? l.credit : l.debit) || 0);
      if (value <= 0) continue;
      const pair = offsetting.indexOf(value);
      if (pair >= 0) { offsetting.splice(pair, 1); continue; }
      facing.push({ line: l, value });
    }
    const pool = facing.length ? facing : others.map((l) => ({ line: l, value: (l.debit || 0) + (l.credit || 0) }));
    const main = pool.sort((a, b) => b.value - a.value)[0]?.line;
    const acc = main ? accById.get(main.accountId) : null;
    const section = acc ? cashFlowSection(acc.subtype, acc.type) : "operating";

    sections[section].push({
      accountId: acc?.id || null,
      number: acc?.number || "",
      name: acc?.name || "",
      nameKey: acc?.nameKey || null,
      amount: net,
    });
  }

  // Συγκέντρωση ανά λογαριασμό μέσα σε κάθε κατηγορία.
  const summarise = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const key = r.accountId || "other";
      if (!map.has(key)) map.set(key, { ...r, amount: 0 });
      map.get(key).amount = round2(map.get(key).amount + r.amount);
    }
    return [...map.values()].sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  };

  const operating = summarise(sections.operating);
  const investing = summarise(sections.investing);
  const financing = summarise(sections.financing);
  const totalOperating = round2(operating.reduce((a, r) => a + r.amount, 0));
  const totalInvesting = round2(investing.reduce((a, r) => a + r.amount, 0));
  const totalFinancing = round2(financing.reduce((a, r) => a + r.amount, 0));
  const netChange = round2(totalOperating + totalInvesting + totalFinancing);
  opening = round2(opening);

  return {
    from, to,
    operating, investing, financing,
    totalOperating, totalInvesting, totalFinancing,
    netChange,
    openingCash: opening,
    closingCash: round2(opening + netChange),
  };
}

// ΕΝΗΛΙΚΙΩΣΗ ΥΠΟΛΟΙΠΩΝ (Aging) — τι οφείλεται και πόσο καιρό, σε κλιμάκια 0-30/31-60/61-90/90+.
// Πελάτες: ανεξόφλητα παραστατικά. Προμηθευτές: αγορές επί πιστώσει που δεν έχουν εξοφληθεί.
function agingBucket(days) {
  if (days <= 30) return "d0";
  if (days <= 60) return "d31";
  if (days <= 90) return "d61";
  return "d91";
}

function emptyBuckets() {
  return { d0: 0, d31: 0, d61: 0, d91: 0, total: 0 };
}

export function arAging(db, asOf) {
  const asOfDate = new Date(asOf);
  const rows = new Map();

  for (const inv of db.invoices || []) {
    if (inv.date > asOf) continue;
    if (inv.isPaymentReceipt && inv.relatedInvoiceId) continue;
    if (inv.type === "credit") continue;
    const outstanding = round2(Number(inv.total || 0) - Number(inv.paidAmount || 0));
    if (outstanding <= 0.005) continue;

    const name = inv.customer?.name || "—";
    const key = inv.customerId || name;
    if (!rows.has(key)) rows.set(key, { name, ...emptyBuckets(), items: [] });
    const r = rows.get(key);

    const days = Math.max(0, Math.floor((asOfDate - new Date(inv.date)) / 86400000));
    const b = agingBucket(days);
    r[b] = round2(r[b] + outstanding);
    r.total = round2(r.total + outstanding);
    r.items.push({ number: inv.number, date: inv.date, days, amount: outstanding });
  }

  const list = [...rows.values()].sort((a, b) => b.total - a.total);
  const totals = emptyBuckets();
  for (const r of list) for (const k of ["d0", "d31", "d61", "d91", "total"]) totals[k] = round2(totals[k] + r[k]);
  return { asOf, rows: list, totals };
}

export function apAging(db, asOf) {
  const asOfDate = new Date(asOf);
  const rows = new Map();

  for (const po of db.purchases || []) {
    if (!po.received || po.paymentMethod !== "credit") continue;
    const date = (po.receivedAt || po.date || "").slice(0, 10);
    if (!date || date > asOf) continue;
    const total = round2((po.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unitCost || 0), 0));
    const outstanding = round2(total - Number(po.paidAmount || 0));
    if (outstanding <= 0.005) continue;

    const name = po.supplier?.name || "—";
    const key = po.supplierId || name;
    if (!rows.has(key)) rows.set(key, { name, ...emptyBuckets(), items: [] });
    const r = rows.get(key);

    const days = Math.max(0, Math.floor((asOfDate - new Date(date)) / 86400000));
    const b = agingBucket(days);
    r[b] = round2(r[b] + outstanding);
    r.total = round2(r.total + outstanding);
    r.items.push({ number: po.number, date, days, amount: outstanding });
  }

  const list = [...rows.values()].sort((a, b) => b.total - a.total);
  const totals = emptyBuckets();
  for (const r of list) for (const k of ["d0", "d31", "d61", "d91", "total"]) totals[k] = round2(totals[k] + r[k]);
  return { asOf, rows: list, totals };
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
