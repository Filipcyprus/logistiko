import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Δημόσια δεδομένα portal για συγκεκριμένο πελάτη (μέσω token).
export async function GET(_req, { params }) {
  const db = readDB();
  const c = db.customers.find((x) => x.b2bEnabled && x.b2bToken === params.token);
  if (!c) return NextResponse.json({ error: "errors.invalidLink" }, { status: 404 });

  const s = db.settings;
  const customPrices = c.customPrices || [];
  const hasCustomPrices = customPrices.length > 0;
  const customPriceMap = new Map(customPrices.map((cp) => [cp.productId, Number(cp.price)]));
  const disc = Number(c.defaultDiscount || 0);

  let products = (db.products || []).map((p) => {
    const hasCustomPrice = customPriceMap.has(p.id);
    const finalPrice = hasCustomPrice ? customPriceMap.get(p.id) : Math.round(p.price * (1 - disc / 100) * 100) / 100;
    return {
      id: p.id, code: p.code, name: p.name, category: p.category,
      unit: p.unit, price: p.price, vatRate: p.vatRate,
      stock: p.stock, trackStock: p.trackStock, image: p.image || "",
      finalPrice, hasCustomPrice,
    };
  });
  // Αν έχουν οριστεί ειδικές τιμές, ο κατάλογος του πελάτη περιορίζεται ΜΟΝΟ σε αυτά τα προϊόντα.
  if (hasCustomPrices) {
    products = products.filter((p) => p.hasCustomPrice);
  }

  const orders = (db.orders || [])
    .filter((o) => o.customerId === c.id)
    .slice(0, 20)
    .map((o) => ({ id: o.id, number: o.number, date: o.date, total: o.total, status: o.status, source: o.source }));

  return NextResponse.json({
    company: {
      name: s.companyName, logo: s.logo, phone: s.phone, email: s.email,
      address: s.address, city: s.city, currency: s.currency,
    },
    customer: {
      id: c.id, name: c.name, priceListName: c.priceListName || "",
      defaultDiscount: disc,
      hasCustomPrices,
      requirePin: c.requirePin !== false,
    },
    categories: Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    products,
    orders,
  });
}
