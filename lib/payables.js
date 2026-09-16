import { round2 } from "@/lib/posting";

// Τι χρωστάμε ακόμα σε προμηθευτές. Δύο πράγματα δημιουργούν υποχρέωση, και τα δύο με
// paymentMethod: "credit" — μια Παραγγελία Αγοράς που παραλήφθηκε επί πιστώσει, και ένα τιμολόγιο
// εξόδου (ενοίκιο, ρεύμα, …) που ήρθε αλλά δεν πληρώθηκε. Εδώ μαζεύεται η κοινή λογική, ώστε το
// Aging, η καρτέλα προμηθευτή και οι πληρωμές να συμφωνούν πάντα μεταξύ τους.

export function purchaseTotal(po) {
  return round2((po.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unitCost || 0), 0));
}

export function expenseTotal(expense) {
  return round2(expense.amount ?? expense.net ?? 0);
}

// Το πληρωμένο ποσό ΔΕΝ κρατιέται αυξητικά: υπολογίζεται από τις ίδιες τις πληρωμές. Έτσι δεν
// μπορεί να ξεσυγχρονιστεί αν μια πληρωμή σβηστεί ή αν αλλάξει το ποσό του τιμολογίου.
export function paidForExpense(db, expenseId) {
  return round2((db.supplierPayments || [])
    .filter((p) => p.expenseId === expenseId)
    .reduce((a, p) => a + Number(p.amount || 0), 0));
}

export function syncExpensePaid(db, expense) {
  expense.paidAmount = paidForExpense(db, expense.id);
  expense.paid = expense.paymentMethod !== "credit" || expense.paidAmount + 0.005 >= expenseTotal(expense);
  return expense;
}

// Ανεξόφλητο υπόλοιπο — 0 για ό,τι πληρώθηκε τοις μετρητοίς ή με κάρτα/τράπεζα τη στιγμή του εξόδου.
export function expenseOutstanding(db, expense) {
  if (expense.paymentMethod !== "credit") return 0;
  return round2(expenseTotal(expense) - paidForExpense(db, expense.id));
}
