import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { generateBarcode } from "@/lib/barcode";

// Ταιριάζει επικεφαλίδες στηλών (πεζά/κεφαλαία, κενά, συνώνυμα) σε ένα σταθερό σύνολο πεδίων.
const FIELD_ALIASES = {
  name: ["name", "product", "productname", "description", "item", "title"],
  sku: ["sku", "code", "productcode"],
  barcode: ["barcode", "ean", "upc"],
  stock: ["stock", "quantity", "qty", "count"],
  price: ["price", "wholesaleprice", "cost", "unitprice"],
  unit: ["unit", "uom"],
  vatRate: ["vat", "vatrate", "tax", "taxrate"],
  category: ["category"],
  brand: ["brand"],
};

function normalizeKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Χτίζει μια αντιστοίχιση canonical πεδίου -> πραγματικό όνομα στήλης στο φύλλο, μία φορά,
// από τα κλειδιά μιας τυπικής γραμμής (οι επικεφαλίδες θεωρούνται ίδιες σε όλο το φύλλο).
function buildFieldMap(rowKeys) {
  const map = {};
  for (const key of rowKeys) {
    const norm = normalizeKey(key);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!map[field] && aliases.includes(norm)) map[field] = key;
    }
  }
  return map;
}

function findMatch(db, barcode, sku, name) {
  if (barcode) {
    const m = db.products.find((p) => p.barcode && p.barcode.trim() === barcode.trim());
    if (m) return { product: m, matchType: "barcode" };
  }
  if (sku) {
    const m = db.products.find((p) => p.sku && p.sku.trim().toLowerCase() === sku.trim().toLowerCase());
    if (m) return { product: m, matchType: "sku" };
  }
  if (name) {
    const m = db.products.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (m) return { product: m, matchType: "name" };
  }
  return null;
}

// Διαβάζει το ανεβασμένο αρχείο και υπολογίζει τι θα άλλαζε — ΔΕΝ γράφει τίποτα ακόμα εκτός
// αν body.apply === "true". Ταιριάζει είδη με barcode/SKU/όνομα· ό,τι δεν ταιριάζει δημιουργείται
// ως νέο προϊόν.
export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const apply = formData.get("apply") === "true";
  if (!file) return NextResponse.json({ error: "errors.noFile" }, { status: 400 });

  let rows;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch (e) {
    return NextResponse.json({ error: "errors.invalidExcelFile" }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "errors.emptyExcelFile" }, { status: 400 });

  const fieldMap = buildFieldMap(Object.keys(rows[0]));
  if (!fieldMap.name) return NextResponse.json({ error: "errors.excelMissingNameColumn" }, { status: 400 });

  const db = readDB();
  const defVat = db.settings.vatRate ?? 19;
  const changes = [];

  for (const row of rows) {
    const name = fieldMap.name ? String(row[fieldMap.name] || "").trim() : "";
    if (!name) continue; // κενή γραμμή

    const barcode = fieldMap.barcode ? String(row[fieldMap.barcode] || "").trim() : "";
    const sku = fieldMap.sku ? String(row[fieldMap.sku] || "").trim() : "";
    const stockRaw = fieldMap.stock ? row[fieldMap.stock] : "";
    const stock = stockRaw === "" || stockRaw == null ? null : Number(stockRaw);
    const price = fieldMap.price && row[fieldMap.price] !== "" ? Number(row[fieldMap.price]) : 0;
    const unit = fieldMap.unit ? String(row[fieldMap.unit] || "").trim() : "";
    const vatRate = fieldMap.vatRate && row[fieldMap.vatRate] !== "" ? Number(row[fieldMap.vatRate]) : defVat;
    const category = fieldMap.category ? String(row[fieldMap.category] || "").trim() : "";
    const brand = fieldMap.brand ? String(row[fieldMap.brand] || "").trim() : "";

    const found = findMatch(db, barcode, sku, name);
    if (found) {
      changes.push({
        action: "update",
        matchType: found.matchType,
        productId: found.product.id,
        name: found.product.name,
        oldStock: Number(found.product.stock || 0),
        newStock: stock != null ? stock : Number(found.product.stock || 0),
      });
    } else {
      changes.push({
        action: "create",
        name,
        barcode, sku, unit, category, brand,
        price,
        vatRate,
        newStock: stock != null ? stock : 0,
      });
    }
  }

  if (!apply) {
    return NextResponse.json({ preview: true, changes });
  }

  // Εφαρμογή: ενημέρωση υπαρχόντων + δημιουργία νέων.
  let updated = 0, created = 0;
  for (const c of changes) {
    if (c.action === "update") {
      const p = db.products.find((x) => x.id === c.productId);
      if (!p || c.newStock === c.oldStock) continue;
      p.stock = c.newStock;
      db.stockMovements.unshift({
        id: uid(), productId: p.id, productName: p.name, type: "adjust",
        quantity: c.newStock,
        reason: serverT(db.settings.language, "stock.reasonExcelImport"),
        ref: null, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
      });
      updated++;
    } else {
      const rec = {
        id: uid(),
        createdAt: new Date().toISOString(),
        code: "", barcode: c.barcode || generateBarcode(), sku: c.sku || "", hsCode: "",
        name: c.name, brand: c.brand || "", category: c.category || "",
        supplierId: "", department: "", productType: "product", targetProfessions: [],
        image: "", unit: c.unit || serverT(db.settings.language, "common.unit"),
        price: c.price, wholesalePrice: c.price, retailPrice: null, cost: 0,
        vatRate: 0, saleVatRate: c.vatRate,
        stock: c.newStock, lowStock: 0, warehouseStocks: [],
        volumeMl: null, weightG: null, shippingRate: 2.4,
        trackStock: true, trackSerial: false, serialNumbers: [],
        trackBatch: false, trackExpiry: false, customDiscountTiers: [], notes: "",
      };
      db.products.push(rec);
      if (rec.stock > 0) {
        db.stockMovements.unshift({
          id: uid(), productId: rec.id, productName: rec.name, type: "in",
          quantity: rec.stock,
          reason: serverT(db.settings.language, "stock.reasonInitial"),
          ref: rec.id, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
        });
      }
      created++;
    }
  }
  writeDB(db);
  return NextResponse.json({ preview: false, updated, created });
}
