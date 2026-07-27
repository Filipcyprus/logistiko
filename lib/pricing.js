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

export function discountTiersForType(productType, customTiers) {
  const tiers = customTiers?.[productType];
  if (Array.isArray(tiers)) return tiers;
  return DEFAULT_QUANTITY_DISCOUNT_TIERS[productType] || [];
}

// A product's own custom tiers (set on the product itself) override the
// type-wide tiers configured in Settings.
export function effectiveDiscountTiers(product, typeTiers) {
  if (Array.isArray(product?.customDiscountTiers) && product.customDiscountTiers.length > 0) {
    return product.customDiscountTiers;
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
