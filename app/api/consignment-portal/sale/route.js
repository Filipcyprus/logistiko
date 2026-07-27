import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifyPortalSession } from "@/lib/portalAuth";
import { registerConsignmentSale } from "@/lib/stockHelpers";
import { logActivity } from "@/lib/audit";

// Καταχώρηση πώλησης από το ίδιο το κατάστημα παρακαταθήκης — το storeId προέρχεται
// ΠΑΝΤΑ από το session (όχι από το body), ώστε ένα κατάστημα να μην μπορεί να καταχωρήσει
// πώληση για κάποιο άλλο κατάστημα.
export async function POST(request) {
  const session = await verifyPortalSession(request, "consignment");
  if (!session) return NextResponse.json({ error: "errors.loginRequired" }, { status: 401 });

  const body = await request.json();
  const qty = Number(body.quantity || 0);
  if (!body.productId || qty <= 0) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }

  const db = readDB();
  const result = registerConsignmentSale(db, {
    storeId: session.linkedId,
    productId: body.productId,
    quantity: qty,
    unitPrice: body.unitPrice,
    date: body.date,
    paymentMethod: body.paymentMethod,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.error === "errors.notFound" ? 404 : 400 });

  writeDB(db);
  await logActivity(request, "consignment_sale", { store: result.sale.storeName, product: result.sale.productName, quantity: qty, total: result.sale.total });
  return NextResponse.json(result.sale, { status: 201 });
}
