// Εισαγωγή του τιμοκαταλόγου ROVRA (xlsx) στην αποθήκη — ΜΟΝΟ προϊόντα που δεν υπάρχουν ήδη.
// Υπάρχον προϊόν = ίδιο SKU (κωδικός προμηθευτή) ή ίδιο όνομα. Τα υπάρχοντα δεν αγγίζονται καθόλου.
//
// Στήλες τιμοκαταλόγου -> προϊόν (όπως τα ήδη υπάρχοντα ROVRA):
//   SKU -> sku · EAN -> barcode · HS CODE -> hsCode · DISTRIBUTOR UNIT PRICE -> cost (κόστος)
//   PRO -> price/wholesalePrice (χονδρική) · FINAL USER -> retailPrice (προτεινόμενη λιανική) · UNIT WEIGHT (GR) -> weightG
//   (η στήλη SPECIAL PROMO δεν χρησιμοποιείται)
// Νέα προϊόντα: απόθεμα 0, προμηθευτής REVER BARBER, τμήμα barber, ΦΠΑ κόστους 21%, ΦΠΑ πώλησης 0%.
//
// Ασφαλές να ξανατρέξει (δεύτερη φορά δεν προσθέτει τίποτα). Χρήση:
//   node scripts/import-rovra-pricelist.js "<file.xlsx>"            (δοκιμή)
//   node scripts/import-rovra-pricelist.js "<file.xlsx>" --apply    (εφαρμογή)

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DB_FILE = path.join(process.cwd(), "data", "db.json");
const SUPPLIER_NAME = "REVER BARBER";
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (s) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "");
const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) ? null : n; };

// ---- όνομα: ΚΕΦΑΛΑΙΑ -> "Rovra Hair Clipper Legion", με διορθώσεις τυπογραφικών του καταλόγου
const KEEP_UPPER = new Set(["RPM", "XL", "V1.6", "V2", "V3", "RT303B", "RT383B", "LED", "HS"]);
const TYPO = [[/\bBABER\b/g, "BARBER"], [/\bCLIPEPR\b/g, "CLIPPER"], [/\bNOOZLE\b/g, "NOZZLE"], [/\bPLATIUM\b/g, "PLATINUM"]];
function cleanName(raw) {
  let s = String(raw).replace(/\s+/g, " ").trim();
  s = s.replace(/^ROVRA\s*-\s*/i, "ROVRA ");
  for (const [re, to] of TYPO) s = s.replace(re, to);
  s = s.replace(/(\d)\s*ML\b/gi, "$1 ml").replace(/(\d)\s*MM\b/gi, "$1 mm").replace(/\bPCS\b/g, "pcs");
  return s.split(" ").map((w) => {
    if (w === "ml" || w === "mm" || w === "pcs" || w === "-" || w === "&" || w === "+" || w === "/") return w;
    if (KEEP_UPPER.has(w)) return w;
    return w.split("/").map((part) => part.split("-").map((x) => (x ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x)).join("-")).join("/");
  }).join(" ");
}

// ---- κατηγορία / υποκατηγορία (ίδια λογική με τα ήδη υπάρχοντα: 4 κατηγορίες, υποκατηγορία = τύπος)
function classify(name) {
  const n = name.toUpperCase();
  if (/REPLACEMENT (BLADE|FOIL)/.test(n)) return { category: "Accessories", subcategory: "replacement blades" };
  if (/HAIR CLIPPER/.test(n)) return { category: "Tools", subcategory: "clippers", serial: true };
  if (/HAIR TRIMMER/.test(n)) return { category: "Tools", subcategory: "trimmers", serial: true };
  if (/\bSHAVER\b/.test(n)) return { category: "Tools", subcategory: "shavers", serial: true };
  if (/HAIR DRYER (?!STAND)/.test(n) && !/HOLDER/.test(n)) return { category: "Tools", subcategory: "hairdryers", serial: true };
  if (/DRYER STAND/.test(n)) return { category: "Tools", subcategory: "hairdryers" };
  if (/SCISSORS SET|SET SCISSORS/.test(n)) return { category: "Tools", subcategory: "scissors" };
  if (/CLIPPER OIL/.test(n)) return { category: "Consumables", subcategory: "oil", consumable: true };
  if (/CLIPP?E?R SPRAY|5-1/.test(n)) return { category: "Consumables", subcategory: "spray", consumable: true };
  if (/HALF BLADES/.test(n)) return { category: "Consumables", subcategory: "blades", consumable: true };
  if (/CAPE/.test(n)) return { category: "Accessories", subcategory: "capes" };
  if (/POWER HUB/.test(n)) return { category: "Accessories", subcategory: "chargers" };
  if (/NOZZLE|DIFFUSER|FRONT COVER/.test(n)) return { category: "Accessories", subcategory: "spare parts" };
  if (/\d\s*mm|COLORED GUARDS|COMB SET/i.test(name)) return { category: "Accessories", subcategory: "guard combs" };
  if (/NECK PAPER/.test(n)) return { category: "Accessories", subcategory: "neck paper" };
  if (/SPRAYER/.test(n)) return { category: "Accessories", subcategory: "sprayer" };
  if (/RAZOR/.test(n)) return { category: "Accessories", subcategory: "razors" };
  if (/BACKPACK|SUITCASE/.test(n)) return { category: "Accessories", subcategory: "bagpack" };
  if (/SILICONE GRIPS/.test(n)) return { category: "Accessories", subcategory: "grips" };
  if (/MIRROR/.test(n)) return { category: "Accessories", subcategory: "mirrors" };
  if (/HOLDER/.test(n)) return { category: "Accessories", subcategory: "holders" };
  if (/POUCH/.test(n)) return { category: "Accessories", subcategory: "pouches" };
  if (/HAIR CLIPS/.test(n)) return { category: "Accessories", subcategory: "hair clips" };
  if (/MAGNETIC MATT/.test(n)) return { category: "Accessories", subcategory: "mats" };
  if (/VEST/.test(n)) return { category: "Accessories", subcategory: "vests" };
  if (/COMB|BRUSH|DUSTER|SPONGE/.test(n)) return { category: "Accessories", subcategory: "brush/combs" };
  return { category: "Accessories", subcategory: "" };
}

function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file || file.startsWith("--")) { console.error("Usage: node scripts/import-rovra-pricelist.js <file.xlsx> [--apply]"); process.exit(1); }

  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" })
    .slice(1).filter((r) => String(r[2]).trim() && String(r[4]).trim());

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  const supplier = (db.suppliers || []).find((s) => norm(s.name) === norm(SUPPLIER_NAME));
  if (!supplier) { console.error(`Supplier "${SUPPLIER_NAME}" not found — aborting.`); process.exit(1); }

  const products = db.products || [];
  // Μόνο προϊόντα ROVRA μετράνε ως "υπάρχον": άλλα προϊόντα (π.χ. τυπογραφείου) έχουν SKU σαν "4135" που
  // θα μπερδευόταν με το "00004135" της ROVRA. Το SKU συγκρίνεται ακριβώς (με τα μηδενικά).
  const isRovra = (p) => norm(p.brand) === "rovra" || /^rovra/i.test(p.name || "");
  const rovraProducts = products.filter(isRovra);
  const bySku = new Map(rovraProducts.filter((p) => p.sku).map((p) => [String(p.sku).trim(), p]));
  const byName = new Map(rovraProducts.map((p) => [norm(p.name), p]));
  const barcodeOwners = new Map();
  for (const p of products) if (p.barcode) (barcodeOwners.get(digits(p.barcode)) || barcodeOwners.set(digits(p.barcode), []).get(digits(p.barcode))).push(p.name);

  const already = [], toAdd = [], seenSku = new Set();
  const usedIds = new Set(products.map((p) => p.id));
  for (const r of rows) {
    const sku = String(r[2]).trim();
    const name = cleanName(r[4]);
    if (seenSku.has(sku)) { console.log(`(skipped repeated SKU in the sheet: ${sku})`); continue; }
    seenSku.add(sku);
    const existing = bySku.get(sku) || byName.get(norm(name));
    if (existing) { already.push({ sku, sheetName: name, existing }); continue; }

    const cls = classify(name);
    const dist = num(r[7]);
    let id = uid();
    while (usedIds.has(id)) id = uid();
    usedIds.add(id);
    const rec = {
      id, createdAt: new Date().toISOString(),
      code: "", barcode: String(r[3]).trim(), sku, hsCode: String(r[1]).trim(),
      name, brand: "ROVRA", category: cls.category, subcategory: cls.subcategory,
      supplierId: supplier.id, department: "barber", productType: cls.consumable ? "consumable" : "equipment",
      targetProfessions: ["Barber"], image: "", unit: "pcs",
      price: num(r[5]) ?? 0, wholesalePrice: num(r[5]) ?? 0, retailPrice: num(r[6]),
      cost: dist == null ? 0 : round2(dist), vatRate: 21, saleVatRate: 0,
      stock: 0, lowStock: 0, warehouseStocks: [], volumeMl: null, weightG: num(r[12]) || null, shippingRate: 2.4,
      trackStock: true, trackSerial: !!cls.serial, serialNumbers: [], trackBatch: false, trackExpiry: false,
      customDiscountTiers: [], notes: "", updatedAt: new Date().toISOString(),
    };
    toAdd.push(rec);
  }

  console.log(`Price list: ${rows.length} products. Already in stock: ${already.length}. New: ${toAdd.length}.\n`);
  console.log("=== ALREADY IN STOCK (untouched) ===");
  for (const a of already) console.log(`  ${a.sku}  ${a.sheetName}   ==   ${a.existing.name}`);
  console.log("\n=== NEW PRODUCTS ===");
  for (const p of toAdd) {
    const dup = digits(p.barcode) ? (barcodeOwners.get(digits(p.barcode)) || []) : [];
    console.log(`  ${p.sku}  ${p.name}  | ${p.category} › ${p.subcategory || "—"} | cost ${p.cost} · wholesale ${p.price} · retail ${p.retailPrice ?? "—"} | ${p.weightG ?? "—"} g | EAN ${p.barcode || "—"}${dup.length ? `   !! EAN also used by: ${dup.join(", ")}` : ""}`);
  }
  const eanCount = {};
  for (const p of toAdd) if (p.barcode) eanCount[digits(p.barcode)] = (eanCount[digits(p.barcode)] || []).concat(p.name);
  const sameEan = Object.values(eanCount).filter((l) => l.length > 1);
  if (sameEan.length) { console.log("\nNew products sharing an EAN with each other:"); sameEan.forEach((l) => console.log("   ", l.join(" / "))); }
  const noEan = toAdd.filter((p) => !p.barcode).map((p) => p.name);
  if (noEan.length) console.log(`\nNew products without an EAN in the list: ${noEan.join(" ; ")}`);

  if (!apply) { console.log("\nDry run only — nothing written. Re-run with --apply to add the new products."); return; }
  db.products = [...products, ...toAdd];
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmp, DB_FILE);
  console.log(`\nAdded ${toAdd.length} products. db.json updated.`);
}

main();
