import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { createDoc } from "@/lib/docs";
import { serverT } from "@/lib/i18n/server";

// Υποβολή παραγγελίας από τον B2B πελάτη.
export async function POST(request, { params }) {
  const body = await request.json();
  const db = readDB();
  const c = db.customers.find((x) => x.b2bEnabled && x.b2bToken === params.token);
  if (!c) return NextResponse.json({ error: "errors.invalidLink" }, { status: 404 });

  // Έλεγχος PIN (μόνο αν απαιτείται για αυτόν τον πελάτη)
  if (c.requirePin !== false && c.b2bPin && String(body.pin || "") !== String(c.b2bPin)) {
    return NextResponse.json({ error: "errors.invalidPin" }, { status: 401 });
  }

  const items = (body.items || []).filter((it) => it.description && Number(it.quantity) > 0);
  if (items.length === 0) {
    return NextResponse.json({ error: "errors.cartEmpty" }, { status: 400 });
  }

  const discount = Number(c.defaultDiscount || 0);
  const doc = createDoc("orders", {
    customerId: c.id,
    deliveryDate: body.deliveryDate || "",
    notes: body.notes ? `[B2B] ${body.notes}` : serverT(db.settings.language, "portal.defaultNote"),
    source: "b2b",
    items: items.map((it) => ({
      productId: it.productId || null,
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit || serverT(db.settings.language, "common.unit"),
      unitPrice: Number(it.unitPrice || 0),
      vatRate: Number(it.vatRate || 0),
      discount: Number(it.discount != null ? it.discount : discount),
    })),
  });

  if (doc.error) return NextResponse.json(doc, { status: 400 });
  return NextResponse.json({ number: doc.number, id: doc.id, total: doc.total }, { status: 201 });
}
