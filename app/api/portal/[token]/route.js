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

  // Εκπτώσεις ανά μάρκα/κατηγορία για ΑΥΤΟΝ τον πελάτη. Για κάθε προϊόν:
  //   1. ειδική τιμή  → η τιμή που ορίστηκε, χωρίς καμία έκπτωση
  //   2. κανόνας μάρκας/κατηγορίας που ταιριάζει → αυτό το ποσοστό (αν ταιριάζουν και οι δύο,
  //      κερδίζει το μεγαλύτερο — δεν προστίθενται) — ΑΝΤΙ για τη γενική έκπτωση
  //   3. αλλιώς → η γενική έκπτωση του πελάτη
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const discountRules = Array.isArray(c.discountRules) ? c.discountRules : [];
  const ruleDiscountFor = (p) => {
    let best = null;
    for (const r of discountRules) {
      const matches = r.type === "brand" ? norm(p.brand) === norm(r.value) : norm(p.category) === norm(r.value);
      if (matches && (best === null || Number(r.percent) > best)) best = Number(r.percent);
    }
    return best;
  };

  let products = (db.products || []).map((p) => {
    const hasCustomPrice = customPriceMap.has(p.id);
    const ruleDisc = hasCustomPrice ? null : ruleDiscountFor(p);
    const discountPercent = hasCustomPrice ? 0 : (ruleDisc !== null ? ruleDisc : disc);
    const finalPrice = hasCustomPrice ? customPriceMap.get(p.id) : Math.round(p.price * (1 - discountPercent / 100) * 100) / 100;
    return {
      id: p.id, code: p.code, name: p.name, category: p.category, brand: p.brand || "",
      // Ο συντελεστής ΦΠΑ πρέπει να είναι αυτός της ΠΩΛΗΣΗΣ (saleVatRate), όχι της αγοράς
      // (vatRate) — αλλιώς ο πελάτης B2B χρεώνεται με λάθος ΦΠΑ σε αυτή την παραγγελία.
      unit: p.unit, price: p.price, retailPrice: p.retailPrice, vatRate: p.saleVatRate ?? p.vatRate ?? 19,
      stock: p.stock, trackStock: p.trackStock, image: p.image || "",
      targetProfessions: p.targetProfessions || [],
      productType: p.productType || "",
      customDiscountTiers: p.customDiscountTiers || [],
      weightG: p.weightG || 0,
      finalPrice, hasCustomPrice, discountPercent,
    };
  });
  // Οι ειδικές τιμές ΔΕΝ κρύβουν πια τον υπόλοιπο κατάλογο: τα προϊόντα με ειδική τιμή εμφανίζονται
  // πάντα, με την τιμή που όρισε ο ιδιοκτήτης, και όλα τα υπόλοιπα όπως ήταν (γενική τιμή/έκπτωση).
  // Το φίλτρο επαγγέλματος ισχύει για τα υπόλοιπα — ένα προϊόν με ειδική τιμή δεν κρύβεται ποτέ,
  // γιατί την τιμή την έβαλε συνειδητά ο ιδιοκτήτης για αυτόν τον πελάτη.
  if (c.profession) {
    products = products.filter((p) => p.hasCustomPrice || p.targetProfessions.length === 0 || p.targetProfessions.includes(c.profession));
  }

  const orders = (db.orders || [])
    .filter((o) => o.customerId === c.id)
    .slice(0, 20)
    .map((o) => ({ id: o.id, number: o.number, date: o.date, total: o.total, status: o.status, source: o.source }));

  return NextResponse.json({
    company: {
      name: s.companyName, logo: s.logo, phone: s.phone, email: s.email,
      address: s.address, city: s.city, currency: s.currency, vatRate: s.vatRate ?? 19,
    },
    customer: {
      id: c.id, name: c.name, priceListName: c.priceListName || "",
      defaultDiscount: disc,
      hasCustomPrices,
      requirePin: c.requirePin !== false,
      address: c.address || "", city: c.city || "",
      creditBalance: Math.round((Number(c.creditBalance) || 0) * 100) / 100,
    },
    categories: Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    // Μάρκες από τα προϊόντα που βλέπει ΑΥΤΟΣ ο πελάτης (μετά το φίλτρο επαγγέλματος) — όχι από
    // ολόκληρο τον κατάλογο, αλλιώς θα έβλεπε μάρκες που δεν του πουλάμε.
    brands: Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    quantityDiscounts: s.quantityDiscounts || null,
    products,
    orders,
  });
}
