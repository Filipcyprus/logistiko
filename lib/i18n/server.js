import { translations } from "@/lib/i18n/translations";

// Μετάφραση στο server (API routes) βάσει της αποθηκευμένης γλώσσας στις Ρυθμίσεις.
// Χρησιμοποιείται μόνο για λίγα auto-generated κείμενα (π.χ. αιτίες κινήσεων αποθήκης).
export function serverT(lang, key, vars) {
  const dict = translations[lang] || translations.en;
  let val = key.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), dict);
  if (val === undefined) {
    val = key.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), translations.en);
  }
  if (val === undefined) return key;
  if (vars) {
    return val.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{{${k}}}`));
  }
  return val;
}
