// Κοινή λογική διπλής εγγραφής — χρησιμοποιείται ΚΑΙ από το /api/journal (λίστα άρθρων) ΚΑΙ από
// το /api/trial-balance (αθροίσματα ανά λογαριασμό), ώστε τα δύο ΠΟΤΕ να μην αποκλίνουν μεταξύ
// τους (μία μόνο πηγή αλήθειας για το ποιες εγγραφές υπάρχουν).
//
// Λογαριασμοί που εμφανίζονται (βλ. lib/accounts.js για τους αριθμούς τους):
//   Πώληση, εξοφλημένη τη στιγμή της πώλησης:
//     Χ Ταμείο/Τράπεζα (ανάλογα με τον τρόπο πληρωμής, = total)   Π Πωλήσεις (= net) + ΦΠΑ Εκροών (= vat)
//     Χ Κόστος Πωληθέντων (= qty × κόστος είδους)                 Π Απόθεμα (ίδιο ποσό)
//   Πώληση σε πελάτη επί πιστώσει (ανεξόφλητη κατά τη δημιουργία):
//     Χ Πελάτες (= total)                                         Π Πωλήσεις (= net) + ΦΠΑ Εκροών (= vat)
//     (το ίδιο Κόστος/Απόθεμα όπως πάνω)
//   Είσπραξη πληρωμής πελάτη αργότερα:
//     Χ Ταμείο/Τράπεζα (= amount)                                 Π Πελάτες (= amount)
//   Έξοδο (ήδη πληρωμένο τη στιγμή που καταχωρείται):
//     Χ Έξοδα (= net) + ΦΠΑ Εισροών (= vat)                        Π Ταμείο/Τράπεζα (= amount)
//   Παραλαβή Παραγγελίας Αγοράς (αγορά αποθέματος):
//     Χ Απόθεμα ανά είδος (= qty × unitCost)                       Π Ταμείο/Τράπεζα (= σύνολο)
//
// Αποδείξεις πληρωμής (isPaymentReceipt με relatedInvoiceId) εξαιρούνται από τις πωλήσεις — το
// ποσό τους καταγράφεται ήδη μέσω του δικού του "payments" άρθρου. Μηνιαία κλεισμένες Ζ (βλ.
// /api/z-report) αντικαθιστούν τις μεμονωμένες αποδείξεις (apodeixi) του μήνα με ΜΙΑ συγκεντρωτική
// εγγραφή — έτσι δουλεύει και στην πραγματικότητα ένα ταμείο/POS.
export function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

// "cash" μόνο για ρητά μετρητά· ΟΤΙΔΗΠΟΤΕ άλλο (κάρτα, τραπεζική κατάθεση, επιταγή) καταλήγει
// τελικά στον τραπεζικό λογαριασμό — όχι στο φυσικό ταμείο.
export function cashOrBank(method) {
  return method === "cash" || !method ? "cash" : "bank";
}

function costOfItems(items, productCost) {
  let total = 0;
  for (const it of items || []) {
    if (!it.productId) continue;
    const cost = productCost.get(it.productId);
    if (!cost) continue;
    total += Number(it.quantity || 0) * cost;
  }
  return round2(total);
}

export function buildLedgerEntries(db, from = "0000-01-01", to = "9999-12-31") {
  const entries = [];
  const productCost = new Map((db.products || []).map((p) => [p.id, Number(p.cost || 0)]));
  const paidInvoiceIds = new Set((db.payments || []).filter((p) => p.invoiceId).map((p) => p.invoiceId));
  const closedMonthZs = (db.zReports || []).filter((z) => z.mode === "month" && z.period >= from.slice(0, 7) && z.period <= to.slice(0, 7));
  const closedMonthPeriods = new Set(closedMonthZs.map((z) => z.period));

  for (const i of db.invoices || []) {
    if (i.isPaymentReceipt && i.relatedInvoiceId) continue;
    if (i.date < from || i.date > to) continue;
    if (i.type === "apodeixi" && closedMonthPeriods.has(i.date.slice(0, 7))) continue;
    const total = round2(i.total);
    const net = round2(i.net);
    const vat = round2(i.vat);
    const paidNow = i.status === "paid" && !paidInvoiceIds.has(i.id);
    const debitAccount = paidNow ? cashOrBank(i.paymentMethod) : "receivable";
    const lines = [{ account: debitAccount, debit: total, credit: 0 }];
    if (net) lines.push({ account: "sales", debit: 0, credit: net });
    if (vat) lines.push({ account: "vatOutput", debit: 0, credit: vat });

    const cogs = costOfItems(i.items, productCost);
    if (cogs) {
      lines.push({ account: "cogs", debit: cogs, credit: 0 });
      lines.push({ account: "inventory", debit: 0, credit: cogs });
    }

    entries.push({
      id: `inv-${i.id}`, date: i.date, createdAt: i.createdAt, ref: i.number,
      descKey: i.type === "timologio" ? "journal.descInvoice" : "journal.descReceipt",
      descParams: { number: i.number }, lines,
    });
  }

  // Μία συγκεντρωτική εγγραφή ανά κλεισμένη μηνιαία Ζ (βλ. σχόλιο πάνω από τη συνάρτηση).
  for (const z of closedMonthZs) {
    const [y, m] = z.period.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const lines = [];
    const byMethod = z.byPaymentMethod || [];
    const cashTotal = round2(byMethod.filter((x) => x.method === "cash").reduce((a, x) => a + x.total, 0));
    const bankTotal = round2(byMethod.filter((x) => x.method !== "cash").reduce((a, x) => a + x.total, 0));
    if (cashTotal) lines.push({ account: "cash", debit: cashTotal, credit: 0 });
    if (bankTotal) lines.push({ account: "bank", debit: bankTotal, credit: 0 });
    if (!cashTotal && !bankTotal && z.total) lines.push({ account: "cash", debit: round2(z.total), credit: 0 });
    if (z.net) lines.push({ account: "sales", debit: 0, credit: round2(z.net) });
    if (z.vat) lines.push({ account: "vatOutput", debit: 0, credit: round2(z.vat) });

    // Το Ζ δεν αποθηκεύει ανάλυση κόστους ανά είδος — υπολογίζεται εδώ από τις πραγματικές
    // αποδείξεις του μήνα (ίδιο κόστος ΤΩΡΑ ανά προϊόν· βλ. σημείωση περιορισμού στο Ισοζύγιο).
    const monthReceipts = (db.invoices || []).filter(
      (inv) => inv.type === "apodeixi" && !(inv.isPaymentReceipt && inv.relatedInvoiceId) && String(inv.date).slice(0, 7) === z.period
    );
    let cogsTotal = 0;
    for (const r of monthReceipts) cogsTotal += costOfItems(r.items, productCost);
    cogsTotal = round2(cogsTotal);
    if (cogsTotal) {
      lines.push({ account: "cogs", debit: cogsTotal, credit: 0 });
      lines.push({ account: "inventory", debit: 0, credit: cogsTotal });
    }

    entries.push({
      id: `z-${z.id}`, date: `${z.period}-${String(lastDay).padStart(2, "0")}`, createdAt: z.closedAt, ref: z.number,
      descKey: "journal.descZClosing", descParams: { number: z.number, period: z.period },
      lines,
    });
  }

  for (const p of db.payments || []) {
    if (p.date < from || p.date > to) continue;
    const amount = round2(p.amount);
    if (!amount) continue;
    const account = cashOrBank(p.method);
    entries.push({
      id: `pay-${p.id}`, date: p.date, createdAt: p.createdAt, ref: p.receiptNumber || "",
      descKey: "journal.descPayment", descParams: { number: p.receiptNumber || "" },
      lines: [{ account, debit: amount, credit: 0 }, { account: "receivable", debit: 0, credit: amount }],
    });
  }

  for (const e of db.expenses || []) {
    if (e.date < from || e.date > to) continue;
    const amount = round2(e.amount);
    const net = round2(e.net ?? e.amount);
    const vat = round2(e.vat);
    const account = cashOrBank(e.paymentMethod);
    const lines = [];
    if (net) lines.push({ account: "expensesNet", debit: net, credit: 0 });
    if (vat) lines.push({ account: "vatInput", debit: vat, credit: 0 });
    lines.push({ account, debit: 0, credit: amount });
    entries.push({
      id: `exp-${e.id}`, date: e.date, createdAt: e.createdAt, ref: e.number || "",
      descKey: "journal.descExpense", descParams: { description: e.description || "" },
      lines,
    });
  }

  // Παραλαβές Παραγγελιών Αγοράς — αγορά αποθέματος, χρέωση Απόθεμα ανά είδος (με βάση την τιμή
  // αγοράς unitCost), πίστωση Ταμείου ή Τράπεζας ανάλογα με τον τρόπο πληρωμής που δηλώθηκε κατά
  // την παραλαβή. Χωρίς unitCost/paymentMethod δεν καταχωρείται τίποτα (δεν υπάρχει ποσό να μπει).
  for (const po of db.purchases || []) {
    if (!po.received || !po.paymentMethod) continue;
    const receivedDate = (po.receivedAt || po.updatedAt || po.date || "").slice(0, 10);
    if (!receivedDate || receivedDate < from || receivedDate > to) continue;
    const items = (po.items || []).filter((it) => Number(it.unitCost) > 0 && Number(it.quantity) > 0);
    if (items.length === 0) continue;
    const lines = items.map((it) => ({
      account: "inventory",
      debit: round2(Number(it.quantity) * Number(it.unitCost)),
      credit: 0,
      itemLabel: it.code || it.description,
    }));
    const totalCost = round2(lines.reduce((a, l) => a + l.debit, 0));
    if (!totalCost) continue;
    lines.push({ account: cashOrBank(po.paymentMethod), debit: 0, credit: totalCost });
    entries.push({
      id: `po-${po.id}`, date: receivedDate, createdAt: po.receivedAt || po.updatedAt || po.createdAt, ref: po.number,
      descKey: "journal.descPurchase", descParams: { number: po.number, supplier: po.supplier?.name || "" },
      lines,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  return entries;
}

// Άθροισμα Χρέωσης/Πίστωσης ανά λογαριασμό, από μια λίστα άρθρων.
export function aggregateByAccount(entries) {
  const acct = {};
  for (const e of entries) {
    for (const l of e.lines) {
      if (!acct[l.account]) acct[l.account] = { debit: 0, credit: 0 };
      acct[l.account].debit += l.debit || 0;
      acct[l.account].credit += l.credit || 0;
    }
  }
  for (const k of Object.keys(acct)) {
    acct[k].debit = round2(acct[k].debit);
    acct[k].credit = round2(acct[k].credit);
    acct[k].balance = round2(acct[k].debit - acct[k].credit);
  }
  return acct;
}
