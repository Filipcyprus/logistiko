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

// Υποκατηγορία λογαριασμού ("detail type" στο QuickBooks) — καθορίζει ΠΟΥ ακριβώς εμφανίζεται ο
// λογαριασμός στον Ισολογισμό (Κυκλοφορούν vs Πάγιο vs Βραχυπρόθεσμες υποχρεώσεις κ.λπ.) και πώς
// ταξινομείται στην Κατάσταση Ταμειακών Ροών. Χωρίς αυτό, ο Ισολογισμός είναι μία επίπεδη λίστα.
export const ACCOUNT_SUBTYPES = {
  asset: ["bank", "receivable", "inventory", "otherCurrentAsset", "fixedAsset", "otherAsset"],
  liability: ["payable", "creditCard", "otherCurrentLiability", "longTermLiability"],
  equity: ["equity"],
  income: ["income", "otherIncome"],
  expense: ["cogs", "expense", "otherExpense"],
};

// Ομάδες του Ισολογισμού, με τη σειρά που εμφανίζονται.
export const BALANCE_SHEET_GROUPS = [
  { key: "currentAssets", side: "assets", subtypes: ["bank", "receivable", "inventory", "otherCurrentAsset"] },
  { key: "fixedAssets", side: "assets", subtypes: ["fixedAsset"] },
  { key: "otherAssets", side: "assets", subtypes: ["otherAsset"] },
  { key: "currentLiabilities", side: "liabilities", subtypes: ["payable", "creditCard", "otherCurrentLiability"] },
  { key: "longTermLiabilities", side: "liabilities", subtypes: ["longTermLiability"] },
  { key: "equity", side: "equity", subtypes: ["equity"] },
];

// Ταξινόμηση ταμειακών ροών: με ποια δραστηριότητα σχετίζεται μια κίνηση, ανάλογα με τον
// λογαριασμό που βρίσκεται "απέναντι" από το ταμείο/τράπεζα στην ίδια εγγραφή.
export function cashFlowSection(subtype, type) {
  if (["fixedAsset", "otherAsset"].includes(subtype)) return "investing";
  if (["longTermLiability"].includes(subtype) || type === "equity") return "financing";
  return "operating";
}

// Η προεπιλογή ΔΕΝ είναι η πρώτη της λίστας: η πρώτη είναι η πιο "ειδική" (Ταμείο, Κόστος
// Πωληθέντων) και θα ήταν επικίνδυνη ως αυτόματη επιλογή — ένας νέος λογαριασμός ενεργητικού θα
// μετριόταν ως μετρητά στις ταμειακές ροές. Προεπιλογή είναι πάντα η ουδέτερη "λοιπά".
const DEFAULT_SUBTYPE = {
  asset: "otherCurrentAsset",
  liability: "otherCurrentLiability",
  equity: "equity",
  income: "income",
  expense: "expense",
};

export function defaultSubtypeFor(type) {
  return DEFAULT_SUBTYPE[type] || "otherCurrentAsset";
}

// Το αρχικό λογιστικό σχέδιο. Οι αριθμοί ακολουθούν τη συνηθισμένη διεθνή διάταξη:
// 1xxx Ενεργητικό, 2xxx Υποχρεώσεις, 3xxx Ίδια Κεφάλαια, 4xxx Έσοδα, 5xxx Έξοδα.
export const SEED_ACCOUNTS = [
  { number: "1000", systemKey: "cash", type: "asset", nameKey: "coa.cash" , subtype: "bank" },
  { number: "1010", systemKey: "bank", type: "asset", nameKey: "coa.bank" , subtype: "bank" },
  { number: "1100", systemKey: "receivable", type: "asset", nameKey: "coa.receivable" , subtype: "receivable" },
  { number: "1200", systemKey: "inventory", type: "asset", nameKey: "coa.inventory" , subtype: "inventory" },

  { number: "2000", systemKey: "payable", type: "liability", nameKey: "coa.payable" , subtype: "payable" },
  { number: "2100", systemKey: "vatOutput", type: "liability", nameKey: "coa.vatOutput" , subtype: "otherCurrentLiability" },
  // ΦΠΑ εισροών: απαίτηση από το κράτος, αλλά κρατιέται στην ομάδα 2 ώστε να συμψηφίζεται
  // οπτικά με τον 2100 στον Ισολογισμό (καθαρή θέση ΦΠΑ).
  { number: "2110", systemKey: "vatInput", type: "liability", nameKey: "coa.vatInput" , subtype: "otherCurrentLiability" },

  { number: "3000", systemKey: "capital", type: "equity", nameKey: "coa.capital" , subtype: "equity" },
  { number: "3100", systemKey: "retainedEarnings", type: "equity", nameKey: "coa.retainedEarnings" , subtype: "equity" },
  { number: "3200", systemKey: "drawings", type: "equity", nameKey: "coa.drawings" , subtype: "equity" },

  { number: "4000", systemKey: "sales", type: "income", nameKey: "coa.sales" , subtype: "income" },
  { number: "4100", systemKey: "otherIncome", type: "income", nameKey: "coa.otherIncome" , subtype: "otherIncome" },

  { number: "5000", systemKey: "cogs", type: "expense", nameKey: "coa.cogs" , subtype: "cogs" },
  { number: "5050", systemKey: "expMaterials", type: "expense", nameKey: "coa.materials" , subtype: "expense" },
  { number: "5100", systemKey: "expensesNet", type: "expense", nameKey: "coa.expensesNet" , subtype: "expense" },
  // Λογαριασμοί εξόδων που αντιστοιχούν 1-1 στις κατηγορίες εξόδων της εφαρμογής, ώστε κάθε
  // έξοδο να πηγαίνει μόνο του στη σωστή γραμμή των Αποτελεσμάτων (βλ. lib/postingRules.js).
  { number: "5200", systemKey: "expRent", type: "expense", nameKey: "coa.rent" , subtype: "expense" },
  { number: "5300", systemKey: "expUtilities", type: "expense", nameKey: "coa.utilities" , subtype: "expense" },
  { number: "5400", systemKey: "expPayroll", type: "expense", nameKey: "coa.wages" , subtype: "expense" },
  { number: "5500", type: "expense", nameKey: "coa.bankCharges" , subtype: "expense" },
  { number: "5600", type: "expense", nameKey: "coa.depreciation" , subtype: "expense" },
  { number: "5700", systemKey: "expMarketing", type: "expense", nameKey: "coa.marketing" , subtype: "expense" },
  { number: "5800", systemKey: "expShipping", type: "expense", nameKey: "coa.shipping" , subtype: "expense" },
  { number: "5900", systemKey: "expEquipment", type: "expense", nameKey: "coa.equipment" , subtype: "expense" },
  { number: "5950", systemKey: "expVehicle", type: "expense", nameKey: "coa.vehicle" , subtype: "expense" },
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
  vehicle: "expVehicle",
};

// Συμπληρώνει ό,τι λείπει από λογαριασμούς που φτιάχτηκαν με παλιότερη έκδοση του κώδικα:
//
//   1. Υιοθέτηση: λογαριασμός με τον ίδιο αριθμό με έναν συστημικό του seed αλλά χωρίς systemKey
//      παίρνει το systemKey — αλλιώς το ensureAccounts θα δημιουργούσε ΔΕΥΤΕΡΟ λογαριασμό με τον
//      ίδιο αριθμό (π.χ. δύο "5200 Ενοίκια") και το σχέδιο θα γέμιζε διπλοεγγραφές.
//   2. Υποκατηγορία: από το seed αν ο λογαριασμός είναι γνωστός, αλλιώς η προεπιλογή του τύπου.
//
// Καθαρή συνάρτηση πάνω στο αντικείμενο που της δίνεις: την καλεί και η μηχανή καταχώρισης (που
// μετά αποθηκεύει) και οι αναφορές (που διαβάζουν μόνο), ώστε να βλέπουν ακριβώς τα ίδια δεδομένα.
// Επιστρέφει πόσοι λογαριασμοί άλλαξαν, ώστε ο καλών να ξέρει αν αξίζει να αποθηκεύσει.
export function normalizeAccounts(db) {
  let changed = 0;

  for (const seed of SEED_ACCOUNTS) {
    if (!seed.systemKey) continue;
    if ((db.accounts || []).some((a) => a.systemKey === seed.systemKey)) continue;
    const sameNumber = (db.accounts || []).find((a) => !a.systemKey && String(a.number) === String(seed.number));
    if (sameNumber) {
      sameNumber.systemKey = seed.systemKey;
      sameNumber.isSystem = true;
      changed++;
    }
  }

  for (const a of db.accounts || []) {
    if (a.subtype) continue;
    const seed = SEED_ACCOUNTS.find((s) =>
      s.systemKey ? s.systemKey === a.systemKey : String(s.number) === String(a.number)
    );
    a.subtype = seed?.subtype || defaultSubtypeFor(a.type);
    changed++;
  }

  return changed;
}

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
