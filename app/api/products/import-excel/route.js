import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { generateBarcode } from "@/lib/barcode";

// Ταιριάζει επικεφαλίδες στηλών (πεζά/κεφαλαία, κενά, συνώνυμα — ελληνικά ή αγγλικά) σε ένα
// σταθερό σύνολο πεδίων. Καλύπτει τόσο το δικό μας πρότυπο όσο και τυπικές εξαγωγές παλιότερων
// προγραμμάτων ταμείου/αποθήκης (π.χ. "LIANIKI ME VAT", "XONDRIKI XWRIS VAT", "LastCost1").
const FIELD_ALIASES = {
  // Στήλη ID (από export-excel) — αν υπάρχει και ταιριάζει με υπαρχόν προϊόν, ενημερώνονται ΟΛΑ
  // τα πεδία της γραμμής (ακόμα και όνομα/SKU/barcode), όχι μόνο το απόθεμα — ασφαλές ΜΟΝΟ επειδή
  // το ταίριασμα γίνεται με το αμετάβλητο εσωτερικό id, όχι με πεδία που μπορεί να άλλαξαν.
  id: ["id", "productid"],
  name: ["name", "product", "productname", "description", "description1", "shortname", "item", "title"],
  sku: ["sku", "code", "productcode"],
  barcode: ["barcode", "ean", "upc"],
  stock: ["stock", "quantity", "qty", "count"],
  // Κόστος: τι πλήρωσε ο ίδιος στον προμηθευτή.
  cost: ["cost", "lastcost", "lastcost1", "purchaseprice"],
  // Χονδρική τιμή (χωρίς ΦΠΑ) — αυτό δείχνει το πρόγραμμα ως βασική τιμή πώλησης.
  wholesalePrice: ["price", "wholesaleprice", "unitprice", "xondrikixwrisvat", "xondrikitimixwrisvat"],
  // Λιανική τιμή (με ΦΠΑ) — αν υπάρχει, χρησιμοποιείται ως τελική τιμή λιανικής.
  retailPrice: ["retailprice", "retail", "lianikimevat", "lianikitimimevat"],
  unit: ["unit", "uom"],
  vatRate: ["vat", "vatrate", "tax", "taxrate"],
  category: ["category"],
  brand: ["brand", "description2"],
};

function normalizeKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Χτίζει μια αντιστοίχιση canonical πεδίου -> πραγματικό όνομα στήλης στο φύλλο, μία φορά,
// από τα κλειδιά μιας τυπικής γραμμής (οι επικεφαλίδες θεωρούνται ίδιες σε όλο το φύλλο).
// Η σειρά των στηλών στο ίδιο το αρχείο αποφασίζει ποια κερδίζει αν παραπάνω από μία ταιριάζουν
// στο ίδιο πεδίο (π.χ. Description1 πριν το ShortName).
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

const num = (v) => (v === "" || v == null ? null : Number(v));

// Διαβάζει το ανεβασμένο αρχείο και υπολογίζει τι θα άλλαζε — ΔΕΝ γράφει τίποτα ακόμα εκτός
// αν body.apply === "true". Αν η γραμμή έχει στήλη ID που ταιριάζει με υπάρχον προϊόν (τυπικά από
// export-excel), ενημερώνονται ΟΛΑ τα πεδία που δόθηκαν (όνομα/SKU/barcode/τιμές/απόθεμα κ.λπ.) —
// αυτό επιτρέπει μαζική επεξεργασία ολόκληρου του καταλόγου. Χωρίς ID, ταιριάζει με
// barcode/SKU/όνομα και ενημερώνει ΜΟΝΟ το απόθεμα (η αρχική συμπεριφορά)· ό,τι δεν ταιριάζει
// καθόλου δημιουργείται ως νέο προϊόν.
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

    // Ταίριασμα με ID (από export-excel) — ενημερώνει ΟΛΑ τα πεδία της γραμμής στο σωστό προϊόν,
    // ακόμα κι αν άλλαξε το ίδιο το όνομα/SKU/barcode· ξεχωριστό μονοπάτι από το ταίριασμα
    // barcode/SKU/όνομα παρακάτω (που μένει μόνο-απόθεμα, όπως πριν).
    const idVal = fieldMap.id ? String(row[fieldMap.id] || "").trim() : "";
    const existingById = idVal ? db.products.find((p) => p.id === idVal) : null;
    if (existingById) {
      const fields = {};
      if (fieldMap.name && name && name !== existingById.name) fields.name = name;
      if (fieldMap.sku) {
        const v = String(row[fieldMap.sku] || "").trim();
        if (v !== (existingById.sku || "")) fields.sku = v;
      }
      if (fieldMap.barcode) {
        const v = String(row[fieldMap.barcode] || "").trim();
        if (v !== (existingById.barcode || "")) fields.barcode = v;
      }
      if (fieldMap.wholesalePrice && row[fieldMap.wholesalePrice] !== "") {
        const v = Number(row[fieldMap.wholesalePrice]);
        if (v !== Number(existingById.wholesalePrice ?? existingById.price ?? 0)) fields.wholesalePrice = v;
      }
      if (fieldMap.retailPrice) {
        const raw = row[fieldMap.retailPrice];
        const v = raw === "" ? null : Number(raw);
        if (v !== (existingById.retailPrice ?? null)) fields.retailPrice = v;
      }
      if (fieldMap.stock && row[fieldMap.stock] !== "") {
        const v = Number(row[fieldMap.stock]);
        if (v !== Number(existingById.stock || 0)) fields.stock = v;
      }
      if (fieldMap.cost && row[fieldMap.cost] !== "") {
        const v = Number(row[fieldMap.cost]);
        if (v !== Number(existingById.cost || 0)) fields.cost = v;
      }
      if (fieldMap.vatRate && row[fieldMap.vatRate] !== "") {
        const v = Number(row[fieldMap.vatRate]);
        if (v !== Number(existingById.saleVatRate ?? existingById.vatRate ?? defVat)) fields.saleVatRate = v;
      }
      if (fieldMap.category) {
        const v = String(row[fieldMap.category] || "").trim();
        if (v !== (existingById.category || "")) fields.category = v;
      }
      if (fieldMap.brand) {
        const v = String(row[fieldMap.brand] || "").trim();
        if (v !== (existingById.brand || "")) fields.brand = v;
      }
      if (fieldMap.unit) {
        const v = String(row[fieldMap.unit] || "").trim();
        if (v !== (existingById.unit || "")) fields.unit = v;
      }
      if (Object.keys(fields).length > 0) {
        changes.push({ action: "edit", productId: existingById.id, name: existingById.name, fields });
      }
      continue;
    }

    if (!name) continue; // κενή γραμμή, χωρίς ID

    const barcode = fieldMap.barcode ? String(row[fieldMap.barcode] || "").trim() : "";
    const sku = fieldMap.sku ? String(row[fieldMap.sku] || "").trim() : "";
    const stock = fieldMap.stock ? num(row[fieldMap.stock]) : null;
    const cost = fieldMap.cost && row[fieldMap.cost] !== "" ? Number(row[fieldMap.cost]) : 0;
    const wholesalePrice = fieldMap.wholesalePrice && row[fieldMap.wholesalePrice] !== "" ? Number(row[fieldMap.wholesalePrice]) : 0;
    const retailPrice = fieldMap.retailPrice && row[fieldMap.retailPrice] !== "" ? Number(row[fieldMap.retailPrice]) : null;
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
        cost, wholesalePrice, retailPrice,
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
    if (c.action === "edit") {
      const p = db.products.find((x) => x.id === c.productId);
      if (!p) continue;
      const oldStock = Number(p.stock || 0);
      Object.assign(p, c.fields);
      // Η "τιμή" που χρησιμοποιείται σε παραστατικά/προσφορές ταυτίζεται με τη χονδρική τιμή.
      if (c.fields.wholesalePrice != null) p.price = c.fields.wholesalePrice;
      if (c.fields.stock != null && c.fields.stock !== oldStock) {
        db.stockMovements.unshift({
          id: uid(), productId: p.id, productName: p.name, type: "adjust",
          quantity: c.fields.stock,
          reason: serverT(db.settings.language, "stock.reasonExcelImport"),
          ref: null, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
        });
      }
      updated++;
      continue;
    }
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
        price: c.wholesalePrice, wholesalePrice: c.wholesalePrice,
        retailPrice: c.retailPrice != null ? c.retailPrice : null,
        cost: c.cost,
        vatRate: c.vatRate, saleVatRate: c.vatRate,
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
