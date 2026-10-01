// Μικρό helper για συνδέσμους "λήψη αρχείου" (σχέδια δουλειάς, παραστατικά εξόδων/παραγγελιών).
// Το attribute download="..." σε ένα <a> δεν το σέβονται αξιόπιστα όλα τα mobile browsers —
// κυρίως το iOS Safari ανοίγει εικόνες/PDF στον ενσωματωμένο viewer αντί να τα κατεβάσει.
// Το ?download=1 στο /api/uploads/[filename] στέλνει πραγματικό Content-Disposition: attachment,
// που δουλεύει παντού. Για παλιά συνημμένα που είναι ακόμα ενσωματωμένα ως data: URI (όχι μέσω
// /api/uploads), δεν υπάρχει server να στείλει τέτοιο header — μένει το απλό download attribute.
export function downloadHref(url, name) {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=1${name ? `&name=${encodeURIComponent(name)}` : ""}`;
}
