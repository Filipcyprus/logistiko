// Βοηθητικές συναρτήσεις μορφοποίησης (client & server).

// Τρέχον locale εμφάνισης — ενημερώνεται αυτόματα από το LanguageContext
// όποτε αλλάζει η γλώσσα, ώστε να μη χρειάζεται να περνιέται παντού.
let currentLocale = "el-GR";
export function setFormatLocale(locale) {
  currentLocale = locale || "el-GR";
}

export function money(value, currency = "€") {
  const n = Number(value || 0);
  return (
    n.toLocaleString(currentLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " " + currency
  );
}

export function num(value, digits = 2) {
  const n = Number(value || 0);
  return n.toLocaleString(currentLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(currentLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return (
    d.toLocaleDateString(currentLocale) +
    " " +
    d.toLocaleTimeString(currentLocale, { hour: "2-digit", minute: "2-digit" })
  );
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Υπολογισμός συνόλων παραστατικού από τις γραμμές του.
// Το invoiceDiscount είναι σταθερό ποσό έκπτωσης επί του συνόλου (όχι ποσοστό) και
// επιμερίζεται αναλογικά σε κάθε γραμμή, ώστε ο ΦΠΑ να παραμένει σωστός ακόμα κι όταν
// οι γραμμές έχουν διαφορετικούς συντελεστές.
export function computeTotals(items = [], invoiceDiscount = 0) {
  const lineNets = items.map((it) => {
    const qty = Number(it.quantity || 0);
    const price = Number(it.unitPrice || 0);
    const discount = Number(it.discount || 0); // ποσοστό %
    return qty * price * (1 - discount / 100);
  });

  const grossNet = lineNets.reduce((a, x) => a + x, 0);
  // Η έκπτωση δεν μπορεί να ξεπεράσει το καθαρό σύνολο (δεν βγαίνει αρνητικό παραστατικό).
  const discountAmount = Math.min(Math.max(Number(invoiceDiscount) || 0, 0), grossNet);
  const factor = grossNet > 0 ? 1 - discountAmount / grossNet : 1;

  let net = 0;
  let vat = 0;
  items.forEach((it, i) => {
    const lineNet = lineNets[i] * factor;
    net += lineNet;
    vat += lineNet * (Number(it.vatRate || 0) / 100);
  });

  const round = (x) => Math.round(x * 100) / 100;
  return {
    net: round(net),
    vat: round(vat),
    total: round(net + vat),
    subtotal: round(grossNet),
    discountAmount: round(discountAmount),
  };
}

export function lineTotal(it) {
  const qty = Number(it.quantity || 0);
  const price = Number(it.unitPrice || 0);
  const discount = Number(it.discount || 0);
  const net = qty * price * (1 - discount / 100);
  const vat = net * (Number(it.vatRate || 0) / 100);
  return Math.round((net + vat) * 100) / 100;
}
