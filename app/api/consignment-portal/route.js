import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { verifyPortalSession } from "@/lib/portalAuth";

// Δεδομένα portal καταστήματος παρακαταθήκης: κατάλογος προϊόντων προς παραγγελία,
// τρέχον απόθεμα ΣΤΟ δικό τους κατάστημα, και πρόσφατες πωλήσεις τους.
export async function GET(request) {
  const session = await verifyPortalSession(request, "consignment");
  if (!session) return NextResponse.json({ error: "errors.loginRequired" }, { status: 401 });

  const db = readDB();
  const store = (db.consignmentStores || []).find((s) => s.id === session.linkedId);
  if (!store) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const products = (db.products || []).filter((p) => p.department === "perfumes").map((p) => {
    const entry = (p.consignmentStock || []).find((c) => c.storeId === store.id);
    return {
      id: p.id, code: p.code, name: p.name, category: p.category, unit: p.unit,
      price: p.price, retailPrice: p.retailPrice, vatRate: p.saleVatRate ?? p.vatRate ?? 19, image: p.image || "",
      myStock: entry ? Number(entry.quantity || 0) : 0,
    };
  });

  const recentSales = (db.consignmentSales || []).filter((s) => s.storeId === store.id).slice(0, 30);
  const recentOrders = (db.consignmentOrders || []).filter((o) => o.storeId === store.id).slice(0, 20);

  return NextResponse.json({
    company: { name: db.settings.companyName, currency: db.settings.currency || "€" },
    store: { id: store.id, name: store.name },
    products,
    recentSales,
    recentOrders,
  });
}
