// Κοινή λογική αναζήτησης προϊόντος — χρησιμοποιείται στο Ταμείο, στην Αποθήκη και στις
// γραμμές παραστατικών/προσφορών/παραγγελιών. Ψάχνει σε όνομα + κωδικό + SKU + barcode, και
// χωρίζει το κείμενο αναζήτησης σε λέξεις — κάθε λέξη πρέπει να βρίσκεται ΚΑΠΟΥ στο προϊόν, όχι
// απαραίτητα με τη σειρά που γράφτηκαν (π.χ. "black gel" ταιριάζει με "Gel Ink Roller Black").
export function productMatchesQuery(p, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = [p.name, p.code, p.sku, p.barcode].filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}
