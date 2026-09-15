import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Ισοζύγιο (Trial Balance) — αθροιστικά στοιχεία από την αρχή μέχρι μια ημερομηνία ("έως").
// Το σύστημα δεν κρατάει ξεχωριστό λογιστικό βιβλίο (διπλογραφικό), οπότε τα μεγέθη εδώ
// προκύπτουν από τα ήδη υπάρχοντα δεδομένα με βάση την ίδια λογική διπλής εγγραφής:
//   Πώληση:  Χ Ταμείο/Πελάτες (= total)         Π Πωλήσεις (= net) + ΦΠΑ Εκροών (= vat)
//   Έξοδο:   Χ Έξοδα (= net) + ΦΠΑ Εισροών (= vat)   Π Ταμείο (= amount)
// Άρα Χρέωση = Ταμείο+Πελάτες+Έξοδα+ΦΠΑ_Εισροών = Πωλήσεις+ΦΠΑ_Εκροών = Πίστωση, πάντα —
// χωρίς ανάγκη για "εξισωτική" εγγραφή (βλ. σχόλιο παρακάτω γιατί δουλεύει ακριβώς).
//
// Αποδείξεις πληρωμής (isPaymentReceipt με relatedInvoiceId) εξαιρούνται από τις "πωλήσεις" —
// το ποσό τους έχει ήδη μετρηθεί μέσω του paidAmount του αρχικού παραστατικού που πληρώνουν.
//
// Το απόθεμα (αξία σε κόστος) είναι ΠΑΝΤΑ η τρέχουσα τιμή (δεν κρατάμε ιστορικό στοκ ανά
// ημερομηνία) — γι' αυτό εμφανίζεται ξεχωριστά, ως αναφορά, όχι μέσα στο ισοζύγιο.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const invoices = (db.invoices || []).filter((i) => i.date <= to && !(i.isPaymentReceipt && i.relatedInvoiceId));
  const expenses = (db.expenses || []).filter((e) => e.date <= to);

  const sum = (arr, f) => Math.round(arr.reduce((a, x) => a + Number(f(x) || 0), 0) * 100) / 100;

  const salesNet = sum(invoices, (i) => i.net);
  const salesVat = sum(invoices, (i) => i.vat);
  const expensesNet = sum(expenses, (e) => e.net ?? e.amount);
  const expensesVat = sum(expenses, (e) => e.vat);
  const expensesTotal = sum(expenses, (e) => e.amount);

  // Ταμείο = ό,τι έχει πράγματι εισπραχθεί (paidAmount, όχι το total — καλύπτει και μερικές
  // πληρωμές) μείον ό,τι έχει ξοδευτεί. Πελάτες = ό,τι απομένει ανεξόφλητο ανά παραστατικό.
  const cash = Math.round((sum(invoices, (i) => i.paidAmount) - expensesTotal) * 100) / 100;
  const receivable = sum(invoices, (i) => Number(i.total) - Number(i.paidAmount || 0));

  const inventoryValue = sum(db.products || [], (p) => Number(p.stock || 0) * Number(p.cost || 0));

  const debitTotal = Math.round((cash + receivable + expensesNet + expensesVat) * 100) / 100;
  const creditTotal = Math.round((salesNet + salesVat) * 100) / 100;

  return NextResponse.json({
    to,
    cash, receivable, expensesNet, expensesVat,
    salesNet, salesVat,
    debitTotal, creditTotal,
    inventoryValue,
  });
}
