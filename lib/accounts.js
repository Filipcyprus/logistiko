// Λογιστικό Σχέδιο (Chart of Accounts).
//
// Οι λογαριασμοί ΖΟΥΝ στη βάση (db.accounts) και ο χρήστης μπορεί να προσθέσει/μετονομάσει/
// απενεργοποιήσει δικούς του. Εδώ ορίζεται μόνο το ΑΡΧΙΚΟ σχέδιο (seed) και οι "συστημικοί"
// λογαριασμοί — αυτοί που χρησιμοποιεί η αυτόματη καταχώριση (lib/postingRules.js) και γι' αυτό
// ΔΕΝ διαγράφονται ποτέ. Ο χρήστης μπορεί να τους μετονομάσει, όχι να τους σβήσει.
//
// systemKey = σταθερό εσωτερικό κλειδί (π.χ. "cash") ώστε ο κώδικας να βρίσκει τον λογαριασμό
// ανεξάρτητα από το πώς τον ονόμασε/αρίθμησε ο χρήστης.
//
// type: asset | liability | equity | income | expense
//   - asset/expense   → φυσικό χρεωστικό υπόλοιπο (debit-normal)
//   - liability/equity/income → φυσικό πιστωτικό υπόλοιπο (credit-normal)

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"];

export const DEBIT_NORMAL_TYPES = ["asset", "expense"];

export function isDebitNormal(type) {
  return DEBIT_NORMAL_TYPES.includes(type);
}

// Το αρχικό λογιστικό σχέδιο. Οι αριθμοί ακολουθούν τη συνηθισμένη διεθνή διάταξη:
// 1xxx Ενεργητικό, 2xxx Υποχρεώσεις, 3xxx Ίδια Κεφάλαια, 4xxx Έσοδα, 5xxx Έξοδα.
export const SEED_ACCOUNTS = [
  { number: "1000", systemKey: "cash", type: "asset", nameKey: "coa.cash" },
  { number: "1010", systemKey: "bank", type: "asset", nameKey: "coa.bank" },
  { number: "1100", systemKey: "receivable", type: "asset", nameKey: "coa.receivable" },
  { number: "1200", systemKey: "inventory", type: "asset", nameKey: "coa.inventory" },

  { number: "2000", systemKey: "payable", type: "liability", nameKey: "coa.payable" },
  { number: "2100", systemKey: "vatOutput", type: "liability", nameKey: "coa.vatOutput" },
  // ΦΠΑ εισροών: απαίτηση από το κράτος, αλλά κρατιέται στην ομάδα 2 ώστε να συμψηφίζεται
  // οπτικά με τον 2100 στον Ισολογισμό (καθαρή θέση ΦΠΑ).
  { number: "2110", systemKey: "vatInput", type: "liability", nameKey: "coa.vatInput" },

  { number: "3000", systemKey: "capital", type: "equity", nameKey: "coa.capital" },
  { number: "3100", systemKey: "retainedEarnings", type: "equity", nameKey: "coa.retainedEarnings" },
  { number: "3200", systemKey: "drawings", type: "equity", nameKey: "coa.drawings" },

  { number: "4000", systemKey: "sales", type: "income", nameKey: "coa.sales" },
  { number: "4100", systemKey: "otherIncome", type: "income", nameKey: "coa.otherIncome" },

  { number: "5000", systemKey: "cogs", type: "expense", nameKey: "coa.cogs" },
  { number: "5050", systemKey: "expMaterials", type: "expense", nameKey: "coa.materials" },
  { number: "5100", systemKey: "expensesNet", type: "expense", nameKey: "coa.expensesNet" },
  // Λογαριασμοί εξόδων που αντιστοιχούν 1-1 στις κατηγορίες εξόδων της εφαρμογής, ώστε κάθε
  // έξοδο να πηγαίνει μόνο του στη σωστή γραμμή των Αποτελεσμάτων (βλ. lib/postingRules.js).
  { number: "5200", systemKey: "expRent", type: "expense", nameKey: "coa.rent" },
  { number: "5300", systemKey: "expUtilities", type: "expense", nameKey: "coa.utilities" },
  { number: "5400", systemKey: "expPayroll", type: "expense", nameKey: "coa.wages" },
  { number: "5500", type: "expense", nameKey: "coa.bankCharges" },
  { number: "5600", type: "expense", nameKey: "coa.depreciation" },
  { number: "5700", systemKey: "expMarketing", type: "expense", nameKey: "coa.marketing" },
  { number: "5800", systemKey: "expShipping", type: "expense", nameKey: "coa.shipping" },
  { number: "5900", systemKey: "expEquipment", type: "expense", nameKey: "coa.equipment" },
];

// Κατηγορία εξόδου (όπως τη διαλέγει ο χρήστης στη φόρμα) → λογαριασμός στον οποίο καταχωρίζεται.
// Ό,τι δεν αντιστοιχίζεται εδώ πάει στα Γενικά έξοδα (5100).
export const EXPENSE_CATEGORY_ACCOUNT = {
  rawMaterials: "expMaterials",
  ink: "expMaterials",
  rent: "expRent",
  utilities: "expUtilities",
  payroll: "expPayroll",
  equipment: "expEquipment",
  shipping: "expShipping",
  marketing: "expMarketing",
};

// Βρίσκει λογαριασμό από το σταθερό systemKey (π.χ. "cash"). Επιστρέφει undefined αν λείπει —
// ο καλών πρέπει να το χειριστεί (βλ. lib/posting.js, που ρίχνει καθαρό σφάλμα).
export function findBySystemKey(accounts, systemKey) {
  return (accounts || []).find((a) => a.systemKey === systemKey);
}

export function findById(accounts, id) {
  return (accounts || []).find((a) => a.id === id);
}

// Ταξινόμηση ανά αριθμό λογαριασμού (αύξουσα) — η σειρά που περιμένει κανείς σε κάθε λογιστική
// κατάσταση.
export function sortByNumber(accounts) {
  return [...(accounts || [])].sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
}
