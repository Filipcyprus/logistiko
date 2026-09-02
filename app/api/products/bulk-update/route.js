import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Πεδία που επιτρέπεται να αλλάξουν μαζικά, και τι είδους τιμή δέχονται.
const NUMERIC_FIELDS = ["retailPrice", "wholesalePrice", "cost", "saleVatRate", "vatRate", "lowStock", "stock"];
const TEXT_FIELDS = ["department", "category", "brand"];

// Μαζική επεξεργασία επιλεγμένων προϊόντων — ΕΝΑ πεδίο τη φορά (π.χ. "βάλε λιανική τιμή 2.50
// σε όλα αυτά", "αύξησε την τιμή 10% σε όλα αυτά", "βάλε κατηγορία X σε όλα αυτά").
// mode: "set" (όλα τα πεδία) | "increasePercent" | "decreasePercent" | "increaseAmount" |
// "decreaseAmount" (μόνο αριθμητικά πεδία).
export async function POST(request) {
  const body = await request.json();
  const { productIds, field, mode, value } = body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const isNumeric = NUMERIC_FIELDS.includes(field);
  if (!isNumeric && !TEXT_FIELDS.includes(field)) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  if (!isNumeric && mode !== "set") {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }

  const db = readDB();
  const idSet = new Set(productIds);
  const targets = db.products.filter((p) => idSet.has(p.id));
  if (targets.length === 0) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  let updated = 0;

  for (const p of targets) {
    let newVal;
    if (isNumeric) {
      const current = Number(p[field] || 0);
      const amount = Number(value);
      if (Number.isNaN(amount)) continue;
      if (mode === "set") newVal = round2(amount);
      else if (mode === "increasePercent") newVal = round2(current * (1 + amount / 100));
      else if (mode === "decreasePercent") newVal = round2(current * (1 - amount / 100));
      else if (mode === "increaseAmount") newVal = round2(current + amount);
      else if (mode === "decreaseAmount") newVal = round2(current - amount);
      else continue;
      if (newVal < 0) newVal = 0;
    } else {
      newVal = String(value ?? "").trim();
    }

    const oldVal = p[field];
    if (oldVal === newVal) continue;

    // Το απόθεμα χρειάζεται και καταγραφή κίνησης, για να φαίνεται στο ιστορικό γιατί άλλαξε.
    if (field === "stock") {
      db.stockMovements.unshift({
        id: uid(), productId: p.id, productName: p.name, type: "adjust",
        quantity: newVal,
        reason: serverT(db.settings.language, "stock.reasonBulkEdit"),
        ref: null, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
      });
    }
    p[field] = newVal;
    // Η "τιμή" που χρησιμοποιείται σε παραστατικά/προσφορές ταυτίζεται με τη χονδρική τιμή.
    if (field === "wholesalePrice") p.price = newVal;
    updated++;
  }

  writeDB(db);
  return NextResponse.json({ updated, total: targets.length });
}
