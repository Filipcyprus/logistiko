// Εισαγωγή του cosmetics.xlsx (φύλλα ROVRA, BARBERTIME, IMMORTAL, L3VEL3) στην αποθήκη —
// ΜΟΝΟ προϊόντα που δεν υπάρχουν ήδη. Τα υπάρχοντα προϊόντα δεν αγγίζονται.
//
// Υπάρχον προϊόν = ίδια μάρκα ΚΑΙ (ίδιο SKU/κωδικός  Ή  ίδιο όνομα με ίδιο όγκο/βάρος). Τα ταιριάσματα κατά
// όνομα εμφανίζονται στη δοκιμή για έλεγχο· χειροκίνητες αντιστοιχίσεις: MANUAL_MATCH παρακάτω.
//
// Στήλες -> προϊόν:  Euro Cost Price -> cost · BARBER PRICE -> price/wholesalePrice · RRP -> retailPrice
//   Volume -> weightG (και volumeMl για υγρά) · Product Code/SKU -> sku · EAN/HS CODE (μόνο ROVRA)
//   (οι στήλες TASOS BARBER PRICE, Total Cost Price και τα στοιχεία αποθέματος δεν χρησιμοποιούνται)
// Νέα προϊόντα: απόθεμα 0, τμήμα barber, ΦΠΑ κόστους 21% / πώλησης 0%, barcode αυτόματο (όπως όταν
// φτιάχνεις προϊόν από την εφαρμογή) εκτός αν υπάρχει EAN στο φύλλο.
//
// Ασφαλές να ξανατρέξει. Χρήση:
//   node scripts/import-cosmetics-workbook.js "<cosmetics.xlsx>" [--images <φάκελος>]            (δοκιμή)
//   node scripts/import-cosmetics-workbook.js "<cosmetics.xlsx>" [--images <φάκελος>] --apply     (εφαρμογή)
// Οι φωτογραφίες είναι αρχεία "<Φύλλο>-<γραμμή>.jpg" μέσα στον φάκελο.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const DB_FILE = path.join(process.cwd(), "data", "db.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const SUPPLIER_BY_BRAND = { ROVRA: "REVER BARBER", IMMORTAL: "REVER BARBER", L3VEL3: "REVER BARBER", BARBERTIME: "MEZZA LUNA", SILVERMAX: "MEZZA LUNA" };

// "Τίτλος φύλλου"  ->  ακριβές όνομα του ήδη υπάρχοντος προϊόντος (όταν το όνομα δεν αρκεί για αυτόματο ταίριασμα).
// BAT05 = "Hair Wax 150ml" είναι το Blue Pomade: η σειρά BAT05..BAT08 = Blue, Red, Gold, Silver όπως στο φύλλο.
const MANUAL_MATCH = {
  "BARBERTIME-6": "Hair Wax 150ml",
  "BARBERTIME-147": "Half Blades Super Platinum 100pcs", // = ESM03 (SILVERMAX Super Platinum, 100 blades)
};
// Γραμμές με άχρηστο/διπλό όνομα στο φύλλο (η εικόνα δείχνει τι είναι):
const TITLE_OVERRIDE = { "BARBERTIME-69": "Cologne - LEMON 80C - 5000ml" }; // κίτρινο δοχείο 5L "LEMON" — τίτλος έλειπε
const NAME_OVERRIDE = { "ROVRA-11": "Rovra Hair Clipper Pulse - 7200 RPM - Cordless - Black" }; // το SKU 00006482 (πράσινο) υπάρχει ήδη με το ίδιο όνομα

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const round2 = (n) => Math.round(n * 100) / 100;
const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
function newBarcode() { // ίδιο με lib/barcode.js
  let d = ""; for (let i = 0; i < 12; i++) d += Math.floor(Math.random() * 10);
  let sum = 0; for (let i = 0; i < 12; i++) sum += i % 2 === 0 ? Number(d[i]) : Number(d[i]) * 3;
  return d + ((10 - (sum % 10)) % 10);
}

// ---------------------------------------------------------------- ονόματα
const SMALL = new Set(["in", "of", "and", "for", "de", "with", "to", "a", "on", "is"]);
const KEEP_UPPER = new Set(["PRO", "KIT", "XL", "RPM", "V1", "V2", "V3", "NYC", "SF", "80C", "II", "3D"]);
function titleCase(s) {
  let afterDash = true;
  return s.split(" ").map((w, i) => {
    if (!w) return w;
    if (/^[-&+/|]+$/.test(w)) { afterDash = w === "-"; return w; }
    const start = afterDash; afterDash = false;
    if (/^\(?\d+([.,]\d+)?(ml|g|gr|cm|mm|pcs|l)\)?$/i.test(w)) return w.toLowerCase();
    return w.split("/").map((seg) => seg.split("-").map((p) => {
      const clean = p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (KEEP_UPPER.has(clean)) return p.toUpperCase();
      const lower = p.toLowerCase();
      if (i > 0 && !start && SMALL.has(lower)) return lower;
      return lower.replace(/^([^a-z0-9]*)([a-z0-9])/, (m, pre, ch) => pre + ch.toUpperCase());
    }).join("-")).join("/");
  }).join(" ");
}
function tidy(s) {
  return String(s)
    .replace(/[\r\n]+/g, " ").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim()
    .replace(/(\d)\s*(ml)\b/gi, "$1ml").replace(/(\d)\s*(gr|g)\b/gi, "$1g").replace(/(\d)\s*(cm)\b/gi, "$1cm")
    .replace(/\s+-\s+/g, " - ").replace(/\s+/g, " ").trim();
}
const TYPO = [[/\bBABER\b/gi, "BARBER"], [/\bCLIPEPR\b/gi, "CLIPPER"], [/\bNOOZLE\b/gi, "NOZZLE"], [/\bPLATIUM\b/gi, "PLATINUM"]];
function nameRovra(raw) {
  let s = String(raw).replace(/\s+/g, " ").trim().replace(/^ROVRA\s*-\s*/i, "ROVRA ");
  for (const [re, to] of TYPO) s = s.replace(re, to);
  s = s.replace(/(\d)\s*ML\b/gi, "$1 ml").replace(/(\d)\s*MM\b/gi, "$1 mm").replace(/\bPCS\b/g, "pcs");
  return s.split(" ").map((w) => {
    if (["ml", "mm", "pcs", "-", "&", "+", "/"].includes(w)) return w;
    if (["RPM", "XL", "V1.6", "V2", "V3", "RT303B", "RT383B"].includes(w)) return w;
    return w.split("/").map((part) => part.split("-").map((x) => (x ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x)).join("-")).join("/");
  }).join(" ");
}
function nameBarbertime(raw) {
  let s = tidy(raw).replace(/\s*-\s*BARBERTIME$/i, "").replace(/\s+BARBERTIME$/i, "");
  s = s.replace(/^Ceara de par\b/i, "Hair wax").replace(/^Gel de par\b/i, "Hair gel").replace(/^Fixativ\b/i, "Hair spray")
    .replace(/\bcolonie\b/gi, "cologne").replace(/\bPamatuf\b/gi, "Brush")
    .replace(/^Hairspray\b/i, "Hair spray").replace(/^Shampoo - SALON - 5000ml/i, "Shampoo - SALON - 5000ml");
  return titleCase(s);
}
function nameImmortal(raw) {
  let s = tidy(raw).replace(/\(NEW\)/gi, "").replace(/\s+/g, " ").trim().replace(/^IMMORTAL\s+/i, "");
  s = s.replace(/\s+\(\s*/g, " (").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\(\s*\)/g, "");
  return "Immortal " + titleCase(s.trim());
}
const L3_TYPES = {
  "AFTSHV": "Aftershave", "SHAV": "Shaving Gel", "BLKMASK": "Black Mask", "PNKMASK": "Pink Mask", "SCRUB-MUD": "Mud Scrub",
  "SCRUB-APRI": "Apricot Scrub", "GEL-CREAM": "Hair Gel Cream", "GEL-SUPER": "Hair Gel Super", "GEL-SLIME": "Hair Gel Slime",
  "TINTED-BLACK": "Tinted Gel Black", "WAX-STICK": "Wax Stick", "POWDER": "Powder", "POWDER-WHITE": "Powder White",
  "SCULPTING-CLAY": "Sculpting Clay", "MATTE-PUTTY": "Matte Putty", "POMADE": "Pomade", "FORMING": "Forming Cream", "PASTE": "Paste",
  "SPIDER": "Spider Wax", "BRILL-CREAM": "Brilliantine Cream", "OILSHEEN": "Oil Sheen Spray", "CLIP-SPRAY": "Clipper Spray",
  "FREEZESPRAY": "Freeze Spray", "HAIRSPRAY": "Hair Spray", "SERUM": "Serum", "TEMP-BLACK": "Temporary Hair Color Black",
  "SHAM-COND": "Shampoo & Conditioner", "SHAMPOO-SF": "Sulfate Free Hair Shampoo", "CONDITIONER": "Conditioner", "HAIRTONIC": "Hair Tonic",
  "SEASALT-SPRAY": "Salt Spray", "BEARDBALM": "Beard Balm", "BEARD-OIL": "Beard Oil", "BEARD-SHAMPOO": "Beard Shampoo", "BEARD-FOAM": "Beard Foam",
};
function nameL3(sku) {
  const parts = String(sku).replace(/^L3-/i, "").split("-");
  const last = parts[parts.length - 1];
  const size = /^(\d+)(ML|GR|G)$/i.exec(last);
  const key = (size ? parts.slice(0, -1) : parts).join("-");
  let label = L3_TYPES[key];
  if (!label && parts[0] === "AFTSHV") label = null;
  if (!label && key.startsWith("AFTSHV-")) label = "Aftershave " + titleCase(key.slice(7).toLowerCase());
  if (!label && key.startsWith("SHAV-")) label = "Shaving Gel " + titleCase(key.slice(5).toLowerCase());
  if (!label) return { name: null, size };
  return { name: `L3VEL3 ${label}${size ? " " + size[1] + (size[2].toUpperCase() === "ML" ? "ml" : "g") : ""}`, size };
}

// ---------------------------------------------------------------- κατηγορία
// { category, subcategory, type: cosmetic|consumable|equipment, serial }
function classify(name, brand) {
  const n = name.toLowerCase();
  if (brand === "ROVRA") return classifyRovra(name);
  const cos = (subcategory) => ({ category: "Cosmetics", subcategory, type: "cosmetic" });
  const acc = (subcategory) => ({ category: "Accessories", subcategory, type: "equipment" });
  if (/razor blades|half blades/.test(n)) return { category: "Consumables", subcategory: "blades", type: "consumable" };
  if (/freeze spray|clipper spray/.test(n)) return { category: "Consumables", subcategory: "spray", type: "consumable" };
  if (/\brazors?\b/.test(n)) return acc("razors");
  if (/\bcape\b/.test(n)) return acc("capes");
  if (/\bapron\b/.test(n)) return acc("aprons");
  if (/sprayer|^aftershave spray$|^after ?shave spray$/.test(n)) return acc("sprayer");
  if (/support for barber collar|towel holder/.test(n)) return acc("holders");
  if (/collar|neck strip/.test(n)) return acc("neck paper");
  if (/mixing bowl/.test(n)) return acc("bowls");
  if (/sterili[sz]ation/.test(n)) return acc("sterilizers");
  if (/hemostatic|styptic/.test(n)) return acc("styptic");
  if (/\bcomb\b|\bbrush\b/.test(n)) return acc("brush/combs");
  if (/wax granules|tray wax/.test(n)) return cos("depilatory wax");
  if (/shampoo/.test(n) && !/beard/.test(n)) return cos("shampoo");
  if (/conditioner/.test(n)) return cos("conditioner");
  if (/beard/.test(n)) return cos("beard");
  if (/after ?shave|cologne|eau de|balsam/.test(n)) return cos("aftershave");
  if (/salt spray|sea salt.*(spray)|hair spray - sea salt/.test(n)) return cos("saltspray");
  if (/powder/.test(n)) return cos("powder");
  if (/hair color|coloring|tinted/.test(n)) return cos(/tinted/.test(n) ? "gel" : "color");
  if (/pomade|bril+i?antine/.test(n)) return cos("pomade");
  if (/wax/.test(n)) return cos(/foam wax/.test(n) ? "foam" : "wax");
  if (/shaving gel/.test(n)) return cos("shaving gel");
  if (/mask/.test(n)) return cos("mask");
  if (/cream|putty|paste|clay|forming/.test(n)) return cos("cream");
  if (/\bgel\b/.test(n)) return cos("gel");
  if (/hair ?spray|fixativ|oil sheen/.test(n)) return cos("hairspray");
  if (/tonic/.test(n)) return cos("tonic");
  if (/serum/.test(n)) return cos("serum");
  if (/scrub/.test(n)) return cos("scrub");
  if (/spray/.test(n)) return cos("hairspray");
  return { category: "Accessories", subcategory: "", type: "equipment", unclassified: true };
}
function classifyRovra(name) {
  const n = name.toUpperCase();
  const acc = (subcategory) => ({ category: "Accessories", subcategory, type: "equipment" });
  if (/REPLACEMENT (BLADE|FOIL)/.test(n)) return acc("replacement blades");
  if (/HAIR CLIPPER/.test(n)) return { category: "Tools", subcategory: "clippers", type: "equipment", serial: true };
  if (/HAIR TRIMMER/.test(n)) return { category: "Tools", subcategory: "trimmers", type: "equipment", serial: true };
  if (/\bSHAVER\b/.test(n)) return { category: "Tools", subcategory: "shavers", type: "equipment", serial: true };
  if (/HAIR DRYER (?!STAND)/.test(n) && !/HOLDER/.test(n)) return { category: "Tools", subcategory: "hairdryers", type: "equipment", serial: true };
  if (/DRYER STAND/.test(n)) return { category: "Tools", subcategory: "hairdryers", type: "equipment" };
  if (/SCISSORS SET|SET SCISSORS/.test(n)) return { category: "Tools", subcategory: "scissors", type: "equipment" };
  if (/CLIPPER OIL/.test(n)) return { category: "Consumables", subcategory: "oil", type: "consumable" };
  if (/CLIPP?E?R SPRAY|5-1/.test(n)) return { category: "Consumables", subcategory: "spray", type: "consumable" };
  if (/HALF BLADES/.test(n)) return { category: "Consumables", subcategory: "blades", type: "consumable" };
  if (/CAPE/.test(n)) return acc("capes");
  if (/POWER HUB/.test(n)) return acc("chargers");
  if (/NOZZLE|DIFFUSER|FRONT COVER/.test(n)) return acc("spare parts");
  if (/\d\s*MM|COLORED GUARDS|COMB SET/.test(n)) return acc("guard combs");
  if (/NECK PAPER/.test(n)) return acc("neck paper");
  if (/SPRAYER/.test(n)) return acc("sprayer");
  if (/RAZOR/.test(n)) return acc("razors");
  if (/BACKPACK|SUITCASE/.test(n)) return acc("bagpack");
  if (/SILICONE GRIPS/.test(n)) return acc("grips");
  if (/MIRROR/.test(n)) return acc("mirrors");
  if (/HOLDER/.test(n)) return acc("holders");
  if (/POUCH/.test(n)) return acc("pouches");
  if (/HAIR CLIPS/.test(n)) return acc("hair clips");
  if (/MAGNETIC MATT/.test(n)) return acc("mats");
  if (/VEST/.test(n)) return acc("vests");
  if (/COMB|BRUSH|DUSTER|SPONGE/.test(n)) return acc("brush/combs");
  return { category: "Accessories", subcategory: "", type: "equipment", unclassified: true };
}

// ---------------------------------------------------------------- ταίριασμα με υπάρχοντα (κατά όνομα)
const STOP = new Set(["hair", "after", "shave", "aftershave", "cologne", "colonie", "eau", "de", "du", "original", "reserve", "new", "the", "of", "and", "no",
  "nyc", "infuse", "styling", "ml", "g", "gr", "l3vel3", "immortal", "barbertime", "silvermax", "rovra", "pcs", "with", "for", "a", "wax"]);
function tokens(name) {
  return new Set(norm(name).replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t) && !/^\d+(ml|g|gr|cm|mm|pcs)$/.test(t) && !/^\d{1,2}$/.test(t)));
}
// Ίδια σύνολα λέξεων, ή αρκετά κοινά (>= 2 λέξεις και >= 60%) — όχι απλώς "το ένα περιέχεται στο άλλο".
function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const t of a) if (b.has(t)) inter++;
  const jac = inter / (a.size + b.size - inter);
  if (jac === 1) return 1;
  return inter >= 2 && jac >= 0.6 ? jac : 0;
}

// ---------------------------------------------------------------- φύλλα
function readRows(wb, sheet) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" });
  const hdr = rows[0].map((h) => String(h).trim());
  const col = (re) => hdr.findIndex((h) => re.test(h));
  const c = {
    title: col(/^title$/i), vol: col(/^volume/i), sku: col(/^(sku|product code)$/i), code: col(/^code$/i), ean: col(/^ean$/i), hs: col(/^hs code$/i),
    cost: col(/^euro cost price$/i), price: col(/^barber price$/i), rrp: col(/^rrp$/i), stock: col(/^current stock$/i),
  };
  const out = [];
  rows.forEach((r, i) => {
    if (i === 0 || !r.some((x) => String(x).trim() !== "")) return;
    const g = (k) => (c[k] >= 0 ? r[c[k]] : "");
    out.push({ sheet, row: i + 1, title: String(g("title")), vol: num(g("vol")), sku: String(g("sku")).trim(), code: String(g("code")).trim(), ean: String(g("ean")).trim(), hs: String(g("hs")).trim(),
      cost: num(g("cost")), price: num(g("price")), rrp: num(g("rrp")), stock: num(g("stock")) });
  });
  return out;
}

function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  const imgIdx = process.argv.indexOf("--images");
  const imgDir = imgIdx > 0 ? process.argv[imgIdx + 1] : null;
  if (!file || file.startsWith("--")) { console.error("Usage: node scripts/import-cosmetics-workbook.js <cosmetics.xlsx> [--images <dir>] [--apply]"); process.exit(1); }

  const wb = XLSX.readFile(file);
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  const products = db.products || [];
  const supplierId = (brand) => (db.suppliers || []).find((s) => norm(s.name) === norm(SUPPLIER_BY_BRAND[brand]))?.id;
  for (const b of Object.keys(SUPPLIER_BY_BRAND)) if (!supplierId(b)) { console.error(`Supplier for ${b} not found — aborting.`); process.exit(1); }

  const usedBarcodes = new Set(products.map((p) => p.barcode).filter(Boolean));
  const usedIds = new Set(products.map((p) => p.id));
  const brandOf = (p) => String(p.brand || "").toUpperCase();

  const cands = [];
  const skipped = [];
  for (const sheet of ["ROVRA", "BARBERTIME", "IMMORTAL", "L3VEL3"]) {
    for (const r of readRows(wb, sheet)) {
      let brand = sheet, name, size = null;
      if (sheet === "L3VEL3") { const x = nameL3(r.sku); name = x.name; size = x.size; }
      else if (!TITLE_OVERRIDE[`${sheet}-${r.row}`] && (!r.title.trim() || r.title.trim().length < 3 || /^[\\/|-]+$/.test(r.title.trim()))) name = null;
      else if (sheet === "ROVRA") { if (/products$/i.test(r.title) || !r.sku) continue; name = nameRovra(r.title); }
      else if (sheet === "BARBERTIME") { name = nameBarbertime(TITLE_OVERRIDE[`${sheet}-${r.row}`] || r.title); if (/silvermax/i.test(r.title)) brand = "SILVERMAX"; }
      else name = nameImmortal(r.title);
      if (name && NAME_OVERRIDE[`${sheet}-${r.row}`]) name = NAME_OVERRIDE[`${sheet}-${r.row}`];
      if (!name) { if (r.sku || r.vol != null) skipped.push(`${sheet} row ${r.row}: no usable title/name in the sheet (${JSON.stringify(r.title).slice(0, 40)} · ${r.sku || "no sku"} · ${r.vol ?? "?"})`); continue; }
      cands.push({ ...r, brand, name, l3size: size });
    }
  }

  const sameSku = (p, c) => c.sku && p.sku && norm(p.sku) === norm(c.sku);
  const taken = new Set(); // ένα υπάρχον προϊόν ταιριάζει με ΜΙΑ γραμμή του φύλλου
  const existingOf = (c) => {
    const key = `${c.sheet}-${c.row}`;
    if (MANUAL_MATCH[key]) { const p = products.find((x) => x.name === MANUAL_MATCH[key] && brandOf(x) === c.brand); if (p) { taken.add(p.id); return { p, how: "manual" }; } }
    const pool = products.filter((p) => brandOf(p) === c.brand && !taken.has(p.id));
    const bySku = pool.find((p) => sameSku(p, c));
    if (bySku) { taken.add(bySku.id); return { p: bySku, how: "sku" }; }
    if (c.brand === "ROVRA") { // ίδιο όνομα αρκεί μόνο αν το υπάρχον δεν έχει δικό του SKU (αλλιώς είναι άλλο προϊόν)
      const byName = pool.find((p) => norm(p.name) === norm(c.name) && !p.sku);
      if (byName) { taken.add(byName.id); return { p: byName, how: "name" }; }
      return null;
    }
    const ct = tokens(c.name);
    const vol = c.l3size ? Number(c.l3size[1]) : c.vol;
    let best = null, bestScore = 0;
    for (const p of pool) {
      if (c.sku && p.sku && !sameSku(p, c) && c.brand === "L3VEL3") continue; // L3VEL3: SKU λέει τα πάντα (μέγεθος, τύπος)
      const pv = Number(p.volumeMl || p.weightG || 0);
      const volOk = !vol || !pv || vol === pv || new RegExp(`\b${vol}(ml|g)`, "i").test(p.name);
      if (!volOk) continue;
      const score = similarity(ct, tokens(p.name));
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (best) { taken.add(best.id); return { p: best, how: "name" }; }
    return null;
  };

  const already = [], toAdd = [], dupInSheet = [], seen = new Set();
  for (const c of cands) {
    const ex = existingOf(c);
    if (ex) { already.push({ c, ex }); continue; }
    const dupKey = `${c.brand}|${norm(c.name)}`;
    if (seen.has(dupKey)) { dupInSheet.push(c); continue; }
    seen.add(dupKey);

    const cls = classify(c.name, c.brand);
    // Το "Volume" του φύλλου είναι ml για υγρά αλλά γραμμάρια βάρους για αξεσουάρ (π.χ. άδειο ψεκαστήρι 30 γρ.).
    // Ο τίτλος, όταν έχει μέγεθος (150ml, 20g, 5000ml), υπερισχύει της στήλης.
    const tSize = /(\d+(?:\.\d+)?)\s*(ml|g)\b/i.exec(c.name);
    let weightG, volumeMl;
    if (c.l3size) { weightG = Number(c.l3size[1]); volumeMl = c.l3size[2].toUpperCase() === "ML" ? weightG : null; }
    else if (cls.category !== "Cosmetics") { weightG = c.vol; volumeMl = tSize && tSize[2].toLowerCase() === "ml" ? Number(tSize[1]) : null; }
    else {
      const v = tSize ? Number(tSize[1]) : c.vol;
      weightG = v;
      volumeMl = tSize ? (tSize[2].toLowerCase() === "ml" ? v : null) : (c.sheet !== "BARBERTIME" || /gel|spray|shampoo|tonic|oil|cologne|conditioner|scrub|foam/i.test(c.name) ? v : null);
    }
    let barcode = c.ean;
    if (!barcode) { do barcode = newBarcode(); while (usedBarcodes.has(barcode)); }
    usedBarcodes.add(barcode);
    let id = uid(); while (usedIds.has(id)) id = uid(); usedIds.add(id);
    const rec = {
      id, createdAt: new Date().toISOString(),
      code: "", barcode, sku: c.sku || "", hsCode: c.hs || "",
      name: c.name, brand: c.brand, category: cls.category, subcategory: cls.subcategory,
      supplierId: supplierId(c.brand), department: "barber", productType: cls.type,
      targetProfessions: ["Barber"], image: "", unit: "pcs",
      price: c.price ?? 0, wholesalePrice: c.price ?? 0, retailPrice: c.rrp ?? null,
      cost: c.cost == null ? 0 : round2(c.cost), vatRate: 21, saleVatRate: 0,
      stock: 0, lowStock: 0, warehouseStocks: [], volumeMl: volumeMl || null, weightG: weightG || null, shippingRate: 2.4,
      trackStock: true, trackSerial: !!cls.serial, serialNumbers: [], trackBatch: false, trackExpiry: false,
      customDiscountTiers: [], notes: c.sheet === "L3VEL3" && c.code ? `Supplier code: ${c.code}` : "", updatedAt: new Date().toISOString(),
    };
    toAdd.push({ rec, c, cls });
  }

  // ---------------------------------------------------------------- αναφορά
  console.log(`Workbook rows with a product: ${cands.length}. Already in stock: ${already.length}. New: ${toAdd.length}. Repeated inside the workbook: ${dupInSheet.length}. Skipped: ${skipped.length}.\n`);
  const fuzzy = already.filter((a) => a.ex.how !== "sku");
  console.log(`=== MATCHED TO EXISTING PRODUCTS BY NAME/MANUAL (${fuzzy.length}) — check these ===`);
  for (const a of fuzzy) console.log(`  [${a.ex.how}] ${a.c.sheet}-${a.c.row}  "${a.c.name}" (${a.c.vol ?? "?"})   ==   "${a.ex.p.name}" [${a.ex.p.sku || "no sku"}, ${a.ex.p.volumeMl || a.ex.p.weightG || "?"}]`);
  console.log(`\n=== MATCHED BY SKU (${already.length - fuzzy.length}) ===`);
  console.log("  " + already.filter((a) => a.ex.how === "sku").map((a) => a.ex.p.sku).join(", "));
  const unmatchedExisting = products.filter((p) => ["ROVRA", "BARBERTIME", "IMMORTAL", "L3VEL3", "SILVERMAX"].includes(brandOf(p)) && !already.some((a) => a.ex.p === p));
  console.log(`\n=== EXISTING PRODUCTS NOT FOUND IN THE WORKBOOK (${unmatchedExisting.length}) — just information ===`);
  for (const p of unmatchedExisting) console.log(`  ${p.brand}  ${p.name}  [${p.sku || "no sku"}]`);
  console.log(`\n=== NEW PRODUCTS (${toAdd.length}) ===`);
  for (const { rec, c, cls } of toAdd) console.log(`  ${c.sheet}-${c.row}  ${rec.brand} | ${rec.name} | ${rec.category} › ${rec.subcategory || "—"} | cost ${rec.cost} · price ${rec.price || "—"} · retail ${rec.retailPrice ?? "—"} | ${rec.volumeMl ? rec.volumeMl + "ml" : "—"} / ${rec.weightG ? rec.weightG + "g" : "—"}${rec.sku ? " | " + rec.sku : ""}${cls.unclassified ? "   !! UNCLASSIFIED" : ""}${rec.price ? "" : "   !! NO PRICE"}`);
  if (dupInSheet.length) { console.log("\nRepeated inside the workbook (added once):"); dupInSheet.forEach((c) => console.log(`  ${c.sheet}-${c.row} ${c.name}`)); }
  if (skipped.length) { console.log("\nSkipped rows:"); skipped.forEach((s) => console.log("  " + s)); }
  const l3Mismatch = toAdd.filter(({ c }) => c.l3size && c.vol && Number(c.l3size[1]) !== c.vol);
  if (l3Mismatch.length) { console.log("\nL3VEL3 rows where the SKU size and the Volume column disagree (SKU size used):"); l3Mismatch.forEach(({ c }) => console.log(`  ${c.sku}: SKU says ${c.l3size[1]}, Volume column says ${c.vol}`)); }
  const noBarcodeRovra = products.filter((p) => brandOf(p) === "ROVRA" && !p.barcode);
  console.log(`\nExisting ROVRA products without a barcode (will get an automatic one): ${noBarcodeRovra.map((p) => p.name).join(" ; ") || "none"}`);

  let images = 0;
  if (imgDir) for (const { c } of toAdd) if (fs.existsSync(path.join(imgDir, `${c.sheet}-${c.row}.jpg`))) images++;
  if (imgDir) console.log(`Pictures found for the new products: ${images} of ${toAdd.length}`);

  if (!apply) { console.log("\nDry run only — nothing written. Re-run with --apply to add the products."); return; }

  if (imgDir && !fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const { rec, c } of toAdd) {
    const src = imgDir && path.join(imgDir, `${c.sheet}-${c.row}.jpg`);
    if (src && fs.existsSync(src)) {
      const filename = `${crypto.randomBytes(8).toString("hex").toUpperCase()}-product-${rec.id}.jpg`;
      fs.copyFileSync(src, path.join(UPLOAD_DIR, filename));
      rec.image = `/api/uploads/${filename}`;
    }
  }
  for (const p of noBarcodeRovra) { let b; do b = newBarcode(); while (usedBarcodes.has(b)); usedBarcodes.add(b); p.barcode = b; p.updatedAt = new Date().toISOString(); }
  db.products = [...products, ...toAdd.map((x) => x.rec)];
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmp, DB_FILE);
  console.log(`\nAdded ${toAdd.length} products (${images} with a picture). db.json updated.`);
}

main();
