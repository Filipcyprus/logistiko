// Quantity-based wholesale discount tiers per product type.
// Defaults used until the user configures their own tiers in Settings.
export const DEFAULT_QUANTITY_DISCOUNT_TIERS = {
  cosmetic: [
    { min: 12, percent: 3 },
    { min: 24, percent: 5 },
  ],
  consumable: [
    { min: 48, percent: 7 },
  ],
};

// Tiers always come out from the smallest quantity to the largest, whatever order they were typed in.
// (Unfinished rows with a quantity of 0 are dropped — they would otherwise apply to every order.)
export function sortDiscountTiers(tiers) {
  return [...tiers]
    .filter((t) => Number(t?.min) > 0)
    .sort((a, b) => Number(a.min) - Number(b.min));
}

export function discountTiersForType(productType, customTiers) {
  const tiers = customTiers?.[productType];
  if (Array.isArray(tiers)) return sortDiscountTiers(tiers);
  return sortDiscountTiers(DEFAULT_QUANTITY_DISCOUNT_TIERS[productType] || []);
}

// A product's own custom tiers (set on the product itself) override the
// type-wide tiers configured in Settings.
export function effectiveDiscountTiers(product, typeTiers) {
  if (Array.isArray(product?.customDiscountTiers) && product.customDiscountTiers.length > 0) {
    return sortDiscountTiers(product.customDiscountTiers);
  }
  return discountTiersForType(product?.productType, typeTiers);
}

function percentFromTiers(tiers, quantity) {
  const qty = Number(quantity) || 0;
  let percent = 0;
  for (const t of tiers) if (qty >= t.min) percent = t.percent;
  return percent;
}

export function quantityDiscountPercent(quantity, productType = "cosmetic", customTiers) {
  return percentFromTiers(discountTiersForType(productType, customTiers), quantity);
}

// Τιμή ανά τεμάχιο ανάλογα με την ποσότητα (π.χ. φωτοτυπίες: 1-5 → 0,20 · 6-49 → 0,10 · 50+ → 0,08).
// Είναι ΤΙΜΗ, όχι έκπτωση: η γραμμή δείχνει κατευθείαν την τιμή της κλίμακας. Επιστρέφει null αν το
// προϊόν δεν έχει κλίμακες τιμής, ώστε να μένει η κανονική του τιμή.
export function sortPriceTiers(tiers) {
  return (Array.isArray(tiers) ? tiers : [])
    .filter((t) => Number(t?.min) > 0 && t?.price !== "" && t?.price != null && Number(t.price) >= 0)
    .map((t) => ({ min: Number(t.min), price: Number(t.price) }))
    .sort((a, b) => a.min - b.min);
}

export function priceTierFor(product, quantity) {
  const tiers = sortPriceTiers(product?.priceTiers);
  if (tiers.length === 0) return null;
  const qty = Number(quantity) || 0;
  let price = tiers[0].price; // κάτω από την πρώτη κλίμακα ισχύει η πρώτη τιμή
  for (const t of tiers) if (qty >= t.min) price = t.price;
  return price;
}

export function quantityDiscountPercentForProduct(quantity, product, typeTiers) {
  return percentFromTiers(effectiveDiscountTiers(product, typeTiers), quantity);
}
