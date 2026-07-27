import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { registerConsignmentSale } from "@/lib/stockHelpers";
import { logActivity } from "@/lib/audit";

export async function GET() {
  const db = readDB();
  return NextResponse.json(db.consignmentSales || []);
}

// Καταχώρηση πώλησης σε κατάστημα παρακαταθήκης — μειώνει το απόθεμα εκεί
// και δημιουργεί απόδειξη εσόδου (μόνο τώρα αναγνωρίζεται το έσοδο, όχι όταν στάλθηκε το απόθεμα).
export async function POST(request) {
  const body = await request.json();
  const productId = body.productId;
  const storeId = body.storeId;
  const qty = Number(body.quantity || 0);
  if (!productId || !storeId || qty <= 0) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const db = readDB();
  const result = registerConsignmentSale(db, {
    storeId, productId, quantity: qty, unitPrice: body.unitPrice, date: body.date, paymentMethod: body.paymentMethod,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.error === "errors.notFound" ? 404 : 400 });

  writeDB(db);
  await logActivity(request, "consignment_sale", { store: result.sale.storeName, product: result.sale.productName, quantity: qty, total: result.sale.total });
  return NextResponse.json(result.sale, { status: 201 });
}
