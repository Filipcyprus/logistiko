// Προϊόντα που δεν αποστέλλονται εκτός Κύπρου (εύφλεκτα / αεροζόλ, π.χ. Rovra Freeze Spray): αν ο πελάτης έχει χώρα
// παράδοσης διαφορετική από την Κύπρο (π.χ. Ελλάδα), δεν επιτρέπεται να μπουν σε παραστατικό/παραγγελία.
export function customerIsAbroad(customer) {
  return !!customer && !!customer.country && customer.country !== "CY";
}

export function hasNoShipItem(db, items) {
  return (items || []).some((it) => it.productId && db.products.find((p) => p.id === it.productId)?.noShipAbroad === true);
}

// true → το παραστατικό πρέπει να απορριφθεί.
export function violatesShipRestriction(db, customerId, items) {
  if (!customerId) return false;
  const customer = db.customers.find((c) => c.id === customerId);
  return customerIsAbroad(customer) && hasNoShipItem(db, items);
}
