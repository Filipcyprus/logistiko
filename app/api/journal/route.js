import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Ημερολόγιο Κινήσεων (General Journal) — ένα άρθρο (JV) ανά πραγματικό γεγονός, με τη λογική
// διπλής εγγραφής που ήδη χρησιμοποιεί το /api/trial-balance (βλ. σχόλιο εκεί):
//   Πώληση, εξοφλημένη τη στιγμή της πώλησης (π.χ. λιανική στο Ταμείο):
//     Χ Ταμείο (= total)                        Π Πωλήσεις (= net) + ΦΠΑ Εκροών (= vat)
//   Πώληση σε πελάτη επί πιστώσει (καθόλου/μερικώς ανεξόφλητη κατά τη δημιουργία):
//     Χ Πελάτες (= total)                       Π Πωλήσεις (= net) + ΦΠΑ Εκροών (= vat)
//   Είσπραξη πληρωμής πελάτη αργότερα (ξεχωριστή εγγραφή payments):
//     Χ Ταμείο (= amount)                       Π Πελάτες (= amount)
//   Έξοδο (ήδη πληρωμένο τη στιγμή που καταχωρείται):
//     Χ Αγορές/Έξοδα (= net) + ΦΠΑ Εισροών (= vat)   Π Ταμείο (= amount)
// Αποδείξεις πληρωμής (isPaymentReceipt με relatedInvoiceId) εξαιρούνται από τις πωλήσεις — το
// ποσό τους καταγράφεται ήδη μέσω του δικού του "payments" άρθρου παραπάνω.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || 50)));

  const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  const entries = [];

  // Ένα παραστατικό που ΠΟΤΕ δεν συνδέθηκε με ξεχωριστή είσπραξη (db.payments) και είναι ήδη
  // "paid" ήταν εξοφλημένο ΑΠΕΥΘΕΙΑΣ κατά τη δημιουργία του (π.χ. λιανική στο Ταμείο) — χ Ταμείο.
  // Αν έχει έστω μία συνδεδεμένη είσπραξη, τότε ξεκίνησε ως ανεξόφλητο και πληρώθηκε ΑΡΓΟΤΕΡΑ —
  // χ Πελάτες εδώ, και η ίδια η είσπραξη (παρακάτω) μεταφέρει το ποσό από Πελάτες σε Ταμείο. Χωρίς
  // αυτή τη διάκριση, το τρέχον (already-updated) paidAmount θα έκανε να φαίνεται σαν να πληρώθηκε
  // αμέσως ΚΑΙ να μετρηθεί ξανά η ίδια είσπραξη — διπλή καταμέτρηση στο Ταμείο.
  const paidInvoiceIds = new Set((db.payments || []).filter((p) => p.invoiceId).map((p) => p.invoiceId));

  for (const i of db.invoices || []) {
    if (i.isPaymentReceipt && i.relatedInvoiceId) continue;
    if (i.date < from || i.date > to) continue;
    const total = round2(i.total);
    const net = round2(i.net);
    const vat = round2(i.vat);
    const paidNow = i.status === "paid" && !paidInvoiceIds.has(i.id);
    const debitAccountKey = paidNow ? "cash" : "receivable";
    const lines = [{ account: debitAccountKey, debit: total, credit: 0 }];
    if (net) lines.push({ account: "sales", debit: 0, credit: net });
    if (vat) lines.push({ account: "vatOutput", debit: 0, credit: vat });
    entries.push({
      id: `inv-${i.id}`, date: i.date, createdAt: i.createdAt, ref: i.number,
      descKey: i.type === "timologio" ? "journal.descInvoice" : "journal.descReceipt",
      descParams: { number: i.number }, lines,
    });
  }

  for (const p of db.payments || []) {
    if (p.date < from || p.date > to) continue;
    const amount = round2(p.amount);
    if (!amount) continue;
    entries.push({
      id: `pay-${p.id}`, date: p.date, createdAt: p.createdAt, ref: p.receiptNumber || "",
      descKey: "journal.descPayment", descParams: { number: p.receiptNumber || "" },
      lines: [{ account: "cash", debit: amount, credit: 0 }, { account: "receivable", debit: 0, credit: amount }],
    });
  }

  for (const e of db.expenses || []) {
    if (e.date < from || e.date > to) continue;
    const amount = round2(e.amount);
    const net = round2(e.net ?? e.amount);
    const vat = round2(e.vat);
    const lines = [];
    if (net) lines.push({ account: "expensesNet", debit: net, credit: 0 });
    if (vat) lines.push({ account: "vatInput", debit: vat, credit: 0 });
    lines.push({ account: "cash", debit: 0, credit: amount });
    entries.push({
      id: `exp-${e.id}`, date: e.date, createdAt: e.createdAt, ref: "",
      descKey: "journal.descExpense", descParams: { description: e.description || "" },
      lines,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));

  const total = entries.length;
  const start = (page - 1) * pageSize;
  const pageItems = entries.slice(start, start + pageSize);

  return NextResponse.json({ entries: pageItems, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
}
