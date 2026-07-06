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
export function computeTotals(items = []) {
  let net = 0;
  let vat = 0;
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    const price = Number(it.unitPrice || 0);
    const discount = Number(it.discount || 0); // ποσοστό %
    const lineNet = qty * price * (1 - discount / 100);
    const lineVat = lineNet * (Number(it.vatRate || 0) / 100);
    net += lineNet;
    vat += lineVat;
  }
  const round = (x) => Math.round(x * 100) / 100;
  return { net: round(net), vat: round(vat), total: round(net + vat) };
}

export function lineTotal(it) {
  const qty = Number(it.quantity || 0);
  const price = Number(it.unitPrice || 0);
  const discount = Number(it.discount || 0);
  const net = qty * price * (1 - discount / 100);
  const vat = net * (Number(it.vatRate || 0) / 100);
  return Math.round((net + vat) * 100) / 100;
}
