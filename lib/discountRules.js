// Εκπτώσεις πελάτη ανά μάρκα / κατηγορία / υποκατηγορία — ΣΥΝΔΥΑΣΜΟΣ των τριών.
//
// Ένας κανόνας είναι { brand, category, subcategory, percent }. Ό,τι πεδίο είναι κενό σημαίνει "οποιοδήποτε".
// Ένα προϊόν ταιριάζει όταν ταιριάζουν ΟΛΑ τα πεδία που έχουν συμπληρωθεί:
//   { brand: "ROVRA" }                                → όλα τα ROVRA
//   { brand: "ROVRA", category: "Tools" }             → μόνο τα εργαλεία της ROVRA
//   { brand: "IMMORTAL", category: "Cosmetics", subcategory: "wax" } → μόνο τα wax της IMMORTAL
// Έτσι επιλέγεις "συγκεκριμένα προϊόντα κάθε μάρκας". Αν ταιριάζουν πολλοί κανόνες, κερδίζει η μεγαλύτερη
// έκπτωση (δεν προστίθενται).
//
// Παλιά μορφή { type: "brand"|"category"|"subcategory", value, percent } εξακολουθεί να διαβάζεται.
// Χωρίς imports — το χρησιμοποιούν και ο server και οι σελίδες.

export const norm = (s) => String(s ?? "").trim().toLowerCase();

export function ruleParts(rule) {
  const percent = Number(rule?.percent);
  if (rule && ["brand", "category", "subcategory"].includes(rule.type)) {
    return { brand: rule.type === "brand" ? String(rule.value ?? "") : "", category: rule.type === "category" ? String(rule.value ?? "") : "", subcategory: rule.type === "subcategory" ? String(rule.value ?? "") : "", percent };
  }
  return { brand: String(rule?.brand ?? ""), category: String(rule?.category ?? ""), subcategory: String(rule?.subcategory ?? ""), percent };
}

// Ίδιος κανόνας = ίδιος συνδυασμός (ανεξάρτητα από κεφαλαία/πεζά).
export const ruleKey = (rule) => {
  const r = ruleParts(rule);
  return [norm(r.brand), norm(r.category), norm(r.subcategory)].join("|");
};

// Ταιριάζει το προϊόν με μια ΕΠΙΛΟΓΗ; Κενή επιλογή ταιριάζει με όλα (χρήσιμο για τις λίστες της φόρμας).
export function selectionMatches(sel, p) {
  return (!sel.brand || norm(p.brand) === norm(sel.brand))
    && (!sel.category || norm(p.category) === norm(sel.category))
    && (!sel.subcategory || norm(p.subcategory) === norm(sel.subcategory));
}

// Κανόνας χωρίς κανένα πεδίο δεν ταιριάζει με τίποτα (αλλιώς θα έδινε έκπτωση σε ΟΛΟΝ τον κατάλογο).
export function ruleMatchesProduct(rule, p) {
  const r = ruleParts(rule);
  if (!r.brand && !r.category && !r.subcategory) return false;
  return selectionMatches(r, p);
}

export const ruleLabel = (rule) => {
  const r = ruleParts(rule);
  return [r.brand, r.category, r.subcategory].filter(Boolean).join(" › ");
};

// Η μεγαλύτερη έκπτωση από τους κανόνες που ταιριάζουν, ή null αν δεν ταιριάζει κανένας.
export function bestRuleDiscount(rules, p) {
  let best = null;
  for (const rule of rules || []) {
    if (!ruleMatchesProduct(rule, p)) continue;
    const pct = Number(rule.percent);
    if (Number.isFinite(pct) && (best === null || pct > best)) best = pct;
  }
  return best;
}
