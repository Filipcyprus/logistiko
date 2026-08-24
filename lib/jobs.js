// Σταθερές για τις εργασίες παραγωγής.

export function getPriorities(t) {
  return {
    low: { label: t("jobs.priorities.low"), color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    normal: { label: t("jobs.priorities.normal"), color: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
    high: { label: t("jobs.priorities.high"), color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    urgent: { label: t("jobs.priorities.urgent"), color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  };
}

// Χρώματα σταδίων (κλάσεις Tailwind για επικεφαλίδα στήλης)
export const STAGE_COLORS = {
  slate: { head: "bg-slate-100 text-slate-700", bar: "bg-slate-400" },
  violet: { head: "bg-violet-100 text-violet-700", bar: "bg-violet-500" },
  blue: { head: "bg-sky-100 text-sky-700", bar: "bg-sky-500" },
  amber: { head: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  emerald: { head: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  rose: { head: "bg-rose-100 text-rose-700", bar: "bg-rose-500" },
  brand: { head: "bg-brand-100 text-brand-700", bar: "bg-brand-500" },
};

export const STAGE_COLOR_OPTIONS = ["slate", "violet", "blue", "amber", "emerald", "rose", "brand"];

// Υπολογισμός γραμμής/συνόλου προσφοράς συνεργάτη ανά είδος (τιμή + ΦΠΑ που έδωσε ο συνεργάτης).
// Η τιμή που δίνει ο συνεργάτης είναι το ΣΥΝΟΛΟ για όλη την ποσότητα (π.χ. "€150 για τα 1000 τεμ."),
// όχι τιμή ανά τεμάχιο — έτσι συνήθως δίνονται προσφορές σε τυπογραφικές δουλειές.
export function itemQuoteTotal(it) {
  if (it.partnerUnitPrice == null) return null;
  const net = Number(it.partnerUnitPrice);
  const vat = net * (Number(it.partnerVatRate) || 0) / 100;
  return Math.round((net + vat) * 100) / 100;
}

export function jobQuoteTotal(items) {
  const priced = (items || []).filter((it) => it.partnerUnitPrice != null);
  if (priced.length === 0) return null;
  return Math.round(priced.reduce((sum, it) => sum + itemQuoteTotal(it), 0) * 100) / 100;
}

// Η δική μας προμήθεια: ποσοστό ΚΟΜΜΕΝΟ από το σύνολο της προσφοράς του συνεργάτη — όχι
// προσθήκη πάνω του. Η τιμή που βλέπει/χρεώνει ο πελάτης παραμένει το jobQuoteTotal.
// Επιστρέφει null όσο δεν υπάρχει ακόμα προσφορά συνεργάτη — δεν έχει νόημα ποσοστό επί τίποτα.
export function commissionAmount(items, commissionPercent) {
  const base = jobQuoteTotal(items);
  if (base == null) return null;
  const pct = Number(commissionPercent) || 0;
  return Math.round(base * (pct / 100) * 100) / 100;
}

// Ίδιος υπολογισμός, αλλά ανά γραμμή — για όποιον θέλει να δει το κομμάτι της προμήθειας
// σε κάθε είδος ξεχωριστά, όχι μόνο στο άθροισμα.
export function itemCommissionAmount(it, commissionPercent) {
  const base = itemQuoteTotal(it);
  if (base == null) return null;
  const pct = Number(commissionPercent) || 0;
  return Math.round(base * (pct / 100) * 100) / 100;
}
