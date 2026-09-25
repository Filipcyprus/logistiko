import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { isCatalogueProduct } from "@/lib/catalogue";

// Δημόσιος κατάλογος αρωμάτων (χωρίς σύνδεση): μόνο όσα έχουν προτεινόμενη τιμή πώλησης.
// Δεν επιστρέφονται κόστος, τιμή χονδρικής, ακριβές απόθεμα ή οτιδήποτε εσωτερικό.
export async function GET() {
  const db = readDB();
  const s = db.settings || {};
  const products = (db.products || [])
    .filter(isCatalogueProduct)
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      image: p.image || "",
      retailPrice: Number(p.retailPrice),
      volumeMl: p.volumeMl || null,
      inStock: p.trackStock === false ? true : Number(p.stock) > 0,
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
  return NextResponse.json({
    company: { name: s.companyName || "", logo: s.logo || "", phone: s.phone || "", email: s.email || "", currency: s.currency || "€" },
    brands: Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    products,
  });
}
