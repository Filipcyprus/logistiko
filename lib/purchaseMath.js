// Υπολογισμοί συνόλων μιας Παραγγελίας Αγοράς — ΚΑΘΑΡΟ + ΦΠΑ = ΣΥΝΟΛΟ. Χωρίς imports, ώστε να
// τον χρησιμοποιούν και οι σελίδες (client) και ο server (καταχώριση, αναφορές, πληρωμές) και να
// συμφωνούν πάντα στο ίδιο ποσό.
//
// Κάθε γραμμή έχει unitCost (τιμή αγοράς ΧΩΡΙΣ ΦΠΑ) και vatRate (%). Παλιές γραμμές που δεν είχαν
// vatRate μετράνε ως 0% — έτσι κανένα ήδη καταχωρισμένο σύνολο δεν αλλάζει αναδρομικά.

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Ποσότητα που μετράει για τα χρήματα: ό,τι ΠΑΡΕΛΗΦΘΗΚΕ (receivedQty) όταν υπάρχει, αλλιώς η
// παραγγελθείσα. Το απόθεμα ανεβαίνει με την παραληφθείσα ποσότητα, άρα και το τιμολογιακό ποσό
// πρέπει να βγαίνει από αυτή — αλλιώς τα βιβλία και το ράφι διαφωνούν. Παλιές παραλαβές δεν έχουν
// receivedQty και μένουν ως έχουν.
export function effectiveQty(it) {
  return it.receivedQty != null && it.receivedQty !== "" ? Number(it.receivedQty) : Number(it.quantity || 0);
}

export function lineNet(it) {
  return round2(effectiveQty(it) * Number(it.unitCost || 0));
}

// Το ΦΠΑ στρογγυλοποιείται ανά γραμμή, όπως θα το έγραφε το τιμολόγιο του προμηθευτή.
export function lineVat(it) {
  return round2(lineNet(it) * Number(it.vatRate || 0) / 100);
}

export function purchaseNet(po) {
  return round2((po.items || []).reduce((a, it) => a + lineNet(it), 0));
}

export function purchaseVat(po) {
  return round2((po.items || []).reduce((a, it) => a + lineVat(it), 0));
}

// Αυτό που πληρώνεται πραγματικά στον προμηθευτή: καθαρό + ΦΠΑ.
export function purchaseTotal(po) {
  return round2(purchaseNet(po) + purchaseVat(po));
}
