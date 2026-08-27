// Σταθερές για τις εργασίες παραγωγής.

// Τι επιτρέπεται να δει ο συνεργάτης τυπογραφείο για μια δουλειά — ΠΟΤΕ στοιχεία πελάτη
// (όνομα/τηλέφωνο, προσωπικά δεδομένα) ούτε εσωτερικά οικονομικά στοιχεία (ποσοστό προμήθειας,
// customerId/partnerShopId). Χρησιμοποιείται τόσο στη λίστα δουλειών όσο και στην απάντηση
// μετά από ενημέρωση, ώστε να μη διαρρέουν αυτά τα πεδία από πουθενά.
export function jobForPartner(job) {
  return {
    id: job.id,
    number: job.number,
    title: job.title,
    stageId: job.stageId,
    priority: job.priority,
    dueDate: job.dueDate,
    items: job.items || [],
    designs: job.designs || [],
    notes: job.notes,
    status: job.status,
    messages: job.messages || [],
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

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

// Ποιο ποσοστό ισχύει για ΑΥΤΟ το είδος: το δικό του (αν ο χρήστης όρισε διαφορετικό ποσοστό
// για αυτή τη γραμμή) αλλιώς το γενικό ποσοστό της δουλειάς.
function effectivePercent(it, jobCommissionPercent) {
  return it.commissionPercent != null && it.commissionPercent !== ""
    ? Number(it.commissionPercent)
    : Number(jobCommissionPercent) || 0;
}

// Η δική μας προμήθεια ανά γραμμή: ποσοστό ΚΟΜΜΕΝΟ από το σύνολο της προσφοράς του συνεργάτη για
// αυτό το είδος (όχι προσθήκη πάνω του — η τιμή που βλέπει/χρεώνει ο πελάτης παραμένει η προσφορά
// του συνεργάτη), και μετά προστίθεται ΦΠΑ πάνω στην ίδια την προμήθεια — αυτή είναι δικό μας
// έσοδο για υπηρεσία, άρα φορολογείται ξεχωριστά από το ΦΠΑ του συνεργάτη πάνω στο προϊόν.
// Κάθε γραμμή μπορεί να έχει το δικό της ποσοστό (it.commissionPercent) — αν δεν έχει οριστεί,
// πέφτει στο γενικό ποσοστό της δουλειάς.
export function itemCommissionAmount(it, jobCommissionPercent, vatRate = 0) {
  const base = itemQuoteTotal(it);
  if (base == null) return null;
  const pct = effectivePercent(it, jobCommissionPercent);
  const net = base * (pct / 100);
  const gross = net * (1 + (Number(vatRate) || 0) / 100);
  return Math.round(gross * 100) / 100;
}

// Άθροισμα της ανά γραμμή προμήθειας (με ΦΠΑ) — κάθε γραμμή στρογγυλοποιείται πρώτα ξεχωριστά,
// ώστε το άθροισμα να ταιριάζει ακριβώς με ό,τι φαίνεται όταν κάποιος ανοίξει το "ανά είδος".
export function commissionAmount(items, jobCommissionPercent, vatRate = 0) {
  const priced = (items || []).filter((it) => it.partnerUnitPrice != null);
  if (priced.length === 0) return null;
  return Math.round(priced.reduce((sum, it) => sum + (itemCommissionAmount(it, jobCommissionPercent, vatRate) || 0), 0) * 100) / 100;
}
