// Κατάλογος αρωμάτων — κοινές συναρτήσεις για τη δημόσια σελίδα /catalogue και το portal καταστημάτων
// παρακαταθήκης. Χωρίς imports, ώστε να τρέχει και στον server και στον browser.

const CONCENTRATION_RE = /\b(Extrait de Parfum|Eau de Parfum|Perfume Extract|Parfum Extract)\b/i;
const GENDERS = ["Men", "Women", "Unisex"];

// Τα ονόματα των αρωμάτων έχουν τη μορφή "<Τίτλος>, <Μάρκα>, <Φύλο> - 100ml" (ή "Extrait de Parfum <Τίτλος>, ...").
// Το φύλο δεν υπάρχει πάντα (όταν δεν το γράφει η πηγή).
export function perfumeDisplay(p) {
  const raw = String(p.name || "");
  const noSize = raw.replace(/\s*-\s*\d+\s*ml\s*$/i, "");
  const parts = noSize.split(",").map((s) => s.trim()).filter(Boolean);
  const head = parts[0] || raw;
  const last = parts[parts.length - 1];
  const gender = GENDERS.includes(last) ? last : "";
  const m = head.match(CONCENTRATION_RE);
  const concentration = m ? m[1].replace(/^Parfum Extract$/i, "Perfume Extract") : "";
  const title = head.replace(CONCENTRATION_RE, "").replace(/\s{2,}/g, " ").trim() || head;
  // Το μέγεθος του ονόματος ("- 100ml") υπερισχύει του πεδίου όγκου, που σε παλιά προϊόντα δεν είναι πάντα σωστό.
  const nameSize = raw.match(/(\d+)\s*ml\s*$/i);
  return { title, concentration, gender, sizeMl: nameSize ? Number(nameSize[1]) : Number(p.volumeMl) || null };
}

export function normalizePhone(s) {
  return String(s || "").replace(/[^\d]/g, "").replace(/^(00)?357/, "");
}

// Τα αρώματα που μπαίνουν στον δημόσιο κατάλογο: τμήμα Αρώματα ΚΑΙ προτεινόμενη τιμή πώλησης > 0
// ΚΑΙ όχι κρυμμένο από τον κατάλογο (hideFromCatalogue — το προϊόν μένει κανονικά στο απόθεμα).
export function isCatalogueProduct(p) {
  return p.department === "perfumes" && Number(p.retailPrice) > 0 && !p.hideFromCatalogue;
}
