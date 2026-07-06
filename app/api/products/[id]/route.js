import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/db";
import { generateBarcode } from "@/lib/barcode";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logActivity } from "@/lib/audit";

async function getRole(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return session?.role;
}

export async function GET(_req, { params }) {
  const rec = getById("products", params.id);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PUT(request, { params }) {
  let patch = await request.json();
  const role = await getRole(request);

  // Manager/Cashier μπορούν να προσθέτουν απόθεμα μόνο μέσω παραλαβής/κίνησης αποθήκης,
  // όχι επεξεργαζόμενοι απευθείας το πεδίο stock (θα παρέκαμπτε το ιστορικό κινήσεων).
  if (["manager", "cashier"].includes(role)) delete patch.stock;

  // Καθαρισμός αριθμητικών πεδίων
  for (const k of ["price", "wholesalePrice", "cost", "vatRate", "stock", "lowStock"]) {
    if (patch[k] != null) patch[k] = Number(patch[k]);
  }
  if (patch.retailPrice != null) {
    patch.retailPrice = patch.retailPrice === "" ? null : Number(patch.retailPrice);
  }
  // Η "τιμή" που χρησιμοποιείται σε παραστατικά/προσφορές ταυτίζεται με τη χονδρική τιμή.
  if (patch.wholesalePrice != null) patch.price = patch.wholesalePrice;
  if (!patch.barcode || !patch.barcode.trim()) {
    const existing = getById("products", params.id);
    patch.barcode = existing?.barcode || generateBarcode();
  }
  const rec = update("products", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  await logActivity(request, "product_update", { name: rec.name, id: rec.id, fields: Object.keys(patch) });
  return NextResponse.json(rec);
}

export async function DELETE(request, { params }) {
  const role = await getRole(request);
  if (["manager", "cashier"].includes(role)) return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  const existing = getById("products", params.id);
  remove("products", params.id);
  await logActivity(request, "product_delete", { name: existing?.name || "", id: params.id });
  return NextResponse.json({ ok: true });
}
