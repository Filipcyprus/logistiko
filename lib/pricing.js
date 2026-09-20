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

export function quantityDiscountPercentForProduct(quantity, product, typeTiers) {
  return percentFromTiers(effectiveDiscountTiers(product, typeTiers), quantity);
}
