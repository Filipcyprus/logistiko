import { computeTotals } from "@/lib/format";

// Ποσό της παραγγελίας που μπορεί να πληρωθεί με πιστωτικό υπόλοιπο. Αν ο πελάτης έχει
// περιορισμό κατηγορίας (π.χ. μόνο "Tools"), μετράνε μόνο οι γραμμές προϊόντων εκείνης της κατηγορίας.
export function creditEligibleTotal(items, products, creditCategory) {
  const want = String(creditCategory || "").trim().toLowerCase();
  if (!want) return computeTotals(items).total;
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const eligible = (items || []).filter((it) => String(byId.get(it.productId)?.category || "").trim().toLowerCase() === want);
  return computeTotals(eligible).total;
}
