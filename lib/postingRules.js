import { round2 } from "@/lib/posting";
import { EXPENSE_CATEGORY_ACCOUNT } from "@/lib/accounts";

// Κανόνες αυτόματης καταχώρισης — μετατρέπουν κάθε παραστατικό σε άρθρο Γενικού Καθολικού.
// Καλούνται (α) ζωντανά, τη στιγμή που δημιουργείται το παραστατικό, και (β) από το
// scripts/post-historical-ledger.js για τα παλιά παραστατικά που έγιναν πριν υπάρξει το Καθολικό.
//
//   Πώληση εξοφλημένη:      Χ Ταμείο/Τράπεζα         Π Πωλήσεις + ΦΠΑ Εκροών
//   Πώληση επί πιστώσει:    Χ Πελάτες                Π Πωλήσεις + ΦΠΑ Εκροών
//   (και στις δύο)          Χ Κόστος Πωληθέντων      Π Απόθεμα
//   Είσπραξη πελάτη:        Χ Ταμείο/Τράπεζα         Π Πελάτες
//   Έξοδο:                  Χ Έξοδα + ΦΠΑ Εισροών    Π Ταμείο/Τράπεζα
//   Αγορά (πληρωμένη):      Χ Απόθεμα ανά είδος      Π Ταμείο/Τράπεζα
//   Αγορά επί πιστώσει:     Χ Απόθεμα ανά είδος      Π Προμηθευτές
//   Εξόφληση προμηθευτή:    Χ Προμηθευτές            Π Ταμείο/Τράπεζα
//
// Παρακαταθήκη (consignment): ΔΕΝ καταχωρίζεται τίποτα — το εμπόρευμα δεν είναι δικό μας μέχρι
// να πουληθεί, οπότε δεν υπάρχει ούτε περιουσιακό στοιχείο ούτε υποχρέωση να απεικονιστεί.

// "cash" μόνο για ρητά μετρητά· κάρτα/έμβασμα/επιταγή καταλήγουν στον τραπεζικό λογαριασμό.
export function cashOrBank(method) {
  return method === "cash" || !method ? "cash" : "bank";
}

function costOfItems(items, db) {
  const products = db.products || [];
  let total = 0;
  for (const it of items || []) {
    if (!it.productId) continue;
    const p = products.find((x) => x.id === it.productId);
    const cost = Number(p?.cost || 0);
    if (!cost) continue;
    total += Number(it.quantity || 0) * cost;
  }
  return round2(total);
}

export function entryForInvoice(db, invoice) {
  // Οι αποδείξεις πληρωμής έναντι τιμολογίου δεν είναι πώληση — το ποσό τους καταχωρίζεται μέσω
  // της ίδιας της είσπραξης (payment), αλλιώς θα μετριόταν δύο φορές.
  if (invoice.isPaymentReceipt && invoice.relatedInvoiceId) return null;

  const total = round2(invoice.total);
  const net = round2(invoice.net);
  const vat = round2(invoice.vat);
  if (!total && !net && !vat) return null;

  const isCredit = invoice.type === "credit";
  const sign = isCredit ? -1 : 1; // πιστωτικό = αντίστροφη πώληση

  // Αν το παραστατικό έχει συνδεδεμένη ξεχωριστή είσπραξη, τότε ΔΕΝ εξοφλήθηκε τη στιγμή της
  // πώλησης — ξεκίνησε ως απαίτηση και η είσπραξη (δικό της άρθρο) το μετέφερε αργότερα στο
  // ταμείο. Χωρίς αυτόν τον έλεγχο, το σημερινό status "paid" θα χρέωνε ταμείο εδώ ΚΑΙ ξανά
  // στην είσπραξη — διπλομέτρηση, και αρνητικό υπόλοιπο πελατών.
  const hasLinkedPayment = (db.payments || []).some((p) => p.invoiceId === invoice.id);
  const settledOnTheSpot = invoice.status === "paid" && !hasLinkedPayment;
  const debitKey = settledOnTheSpot ? cashOrBank(invoice.paymentMethod) : "receivable";
  const lines = [];

  // Σε πιστωτικό, οι χρεώσεις/πιστώσεις αντιστρέφονται (αρνητικά ποσά γίνονται πιστώσεις).
  const put = (systemKey, debit, credit, extra = {}) => {
    const d = round2(sign > 0 ? debit : credit);
    const c = round2(sign > 0 ? credit : debit);
    if (d || c) lines.push({ systemKey, debit: d, credit: c, ...extra });
  };

  put(debitKey, total, 0);
  put("sales", 0, net);
  put("vatOutput", 0, vat);

  const cogs = costOfItems(invoice.items, db);
  if (cogs) {
    put("cogs", cogs, 0);
    put("inventory", 0, cogs);
  }

  if (lines.length === 0) return null;
  return {
    date: invoice.date,
    memoKey: invoice.type === "credit" ? "journal.descCredit" : invoice.type === "timologio" ? "journal.descInvoice" : "journal.descReceipt",
    memoParams: { number: invoice.number },
    lines,
  };
}

export function entryForExpense(db, expense) {
  const amount = round2(expense.amount);
  const net = round2(expense.net ?? expense.amount);
  const vat = round2(expense.vat);
  if (!amount && !net) return null;

  const lines = [];
  // Πού χρεώνεται το έξοδο, με σειρά προτεραιότητας:
  //   1. ρητός λογαριασμός που διάλεξε ο χρήστης στη φόρμα,
  //   2. ο λογαριασμός που αντιστοιχεί στην κατηγορία (Ενοίκια → 5200 κ.λπ.),
  //   3. Γενικά έξοδα.
  if (net) {
    const categoryKey = EXPENSE_CATEGORY_ACCOUNT[expense.category];
    if (expense.accountId) lines.push({ accountId: expense.accountId, debit: net, credit: 0 });
    else if (categoryKey) lines.push({ systemKey: categoryKey, debit: net, credit: 0 });
    else lines.push({ systemKey: "expensesNet", debit: net, credit: 0 });
  }
  if (vat) lines.push({ systemKey: "vatInput", debit: vat, credit: 0 });
  // "credit" = τιμολόγιο που ήρθε αλλά ΔΕΝ πληρώθηκε ακόμα. Το έξοδο αναγνωρίζεται κανονικά τώρα
  // (δεδουλευμένη βάση), αλλά απέναντι μπαίνει υποχρέωση προς τον προμηθευτή, όχι έξοδος ταμείου —
  // η εξόφληση γίνεται αργότερα με δικό της άρθρο (/api/supplier-payments).
  lines.push({
    systemKey: expense.paymentMethod === "credit" ? "payable" : cashOrBank(expense.paymentMethod),
    debit: 0,
    credit: amount,
  });

  return {
    date: expense.date,
    memoKey: "journal.descExpense",
    memoParams: { description: expense.description || "" },
    lines,
  };
}

export function entryForPayment(db, payment) {
  const amount = round2(payment.amount);
  if (!amount) return null;
  return {
    date: payment.date,
    memoKey: "journal.descPayment",
    memoParams: { number: payment.receiptNumber || "" },
    lines: [
      { systemKey: cashOrBank(payment.method), debit: amount, credit: 0 },
      { systemKey: "receivable", debit: 0, credit: amount },
    ],
  };
}

export function entryForPurchaseReceipt(db, po) {
  // Παρακαταθήκη ή χωρίς δηλωμένο τρόπο πληρωμής → δεν καταχωρίζεται τίποτα.
  if (!po.received || po.consignment || !po.paymentMethod) return null;

  const items = (po.items || []).filter((it) => Number(it.unitCost) > 0 && Number(it.quantity) > 0);
  if (items.length === 0) return null;

  const lines = items.map((it) => ({
    systemKey: "inventory",
    debit: round2(Number(it.quantity) * Number(it.unitCost)),
    credit: 0,
    itemLabel: it.code || it.description,
  }));
  const totalCost = round2(lines.reduce((a, l) => a + l.debit, 0));
  if (!totalCost) return null;

  lines.push({
    systemKey: po.paymentMethod === "credit" ? "payable" : cashOrBank(po.paymentMethod),
    debit: 0,
    credit: totalCost,
  });

  return {
    date: (po.receivedAt || po.updatedAt || po.date || "").slice(0, 10),
    memoKey: "journal.descPurchase",
    memoParams: { number: po.number, supplier: po.supplier?.name || "" },
    lines,
  };
}

export function entryForSupplierPayment(db, sp) {
  const amount = round2(sp.amount);
  if (!amount) return null;
  return {
    date: sp.date,
    memoKey: "journal.descSupplierPayment",
    memoParams: { supplier: sp.supplierName || "" },
    lines: [
      { systemKey: "payable", debit: amount, credit: 0 },
      { systemKey: cashOrBank(sp.method), debit: 0, credit: amount },
    ],
  };
}
