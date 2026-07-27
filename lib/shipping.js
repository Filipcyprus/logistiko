// ACS courier tiered shipping cost (with VAT), based on weight.
// P2P — Point-to-Point (pickup point to pickup point)
// P2D — Point-to-Destination (pickup point, delivered to recipient island-wide)
export const SHIPPING_METHODS = {
  p2p: {
    tiers: [
      { maxKg: 2, cost: 3.4 },
      { maxKg: 5, cost: 4.8 },
    ],
    extraPerKg: 0.6,
  },
  p2d: {
    tiers: [
      { maxKg: 2, cost: 5.7 },
      { maxKg: 5, cost: 7.3 },
    ],
    extraPerKg: 0.95,
  },
};

// BoxNow — single flat-rate locker service, VAT already included.
export const BOXNOW_COST_WITH_VAT = 2.5;

function ceil2(n) {
  return Math.ceil(n * 100) / 100;
}

// Returns the ACS shipping cost, already including VAT, for a given weight and method.
export function shippingCostForWeightKg(weightKg, method = "p2d") {
  const cfg = SHIPPING_METHODS[method] || SHIPPING_METHODS.p2d;
  const kg = Number(weightKg) || 0;
  if (kg <= 0) return 0;
  if (kg <= cfg.tiers[0].maxKg) return cfg.tiers[0].cost;
  if (kg <= cfg.tiers[1].maxKg) return cfg.tiers[1].cost;
  return ceil2(cfg.tiers[1].cost + (kg - cfg.tiers[1].maxKg) * cfg.extraPerKg);
}

// Returns the BoxNow price, VAT already included.
export function boxNowCostWithVat() {
  return BOXNOW_COST_WITH_VAT;
}
