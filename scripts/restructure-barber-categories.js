// Αναδιάρθρωση κατηγοριών για ΟΛΑ τα προϊόντα του τμήματος Barber:
//   Κατηγορία  = ΜΟΝΟ μία από: Cosmetics / Tools / Accessories / Consumables
//   Υποκατηγορία = ο "τύπος" του είδους (pomade, wax, clippers, blades, oil …) — ό,τι ήταν πριν η κατηγορία
//
//   Cosmetics   = pomade, wax, cream, shampoo, aftershave, beard, saltspray
//   Tools       = shavers, clippers, trimmers, scissors, hair dryers
//   Consumables = blades, oil, spray (5 in 1)
//   Accessories = όλα τα υπόλοιπα
//
// Καθαρίζει και τη λίστα κατηγοριών: μένουν οι 4 + όσες κατηγορίες χρησιμοποιούνται ακόμα από προϊόντα
// άλλων τμημάτων (π.χ. "perfumes"). Τα προϊόντα άλλων τμημάτων δεν αγγίζονται.
//
// Ασφαλές να ξανατρέξει. Χρήση:  node scripts/restructure-barber-categories.js            (δοκιμή)
//                                node scripts/restructure-barber-categories.js --apply    (εφαρμογή)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(process.cwd(), "data", "db.json");
const FINAL = ["Cosmetics", "Tools", "Accessories", "Consumables"];
const norm = (s) => String(s || "").trim().toLowerCase();
const isFinal = (c) => FINAL.some((f) => norm(f) === norm(c));
const finalName = (c) => FINAL.find((f) => norm(f) === norm(c));

const COSMETICS = new Set(["pomade", "wax", "cream", "shampoo", "aftershave", "after shave", "beard", "saltspray", "salt spray"]);
const TOOLS = new Set(["shavers", "clippers", "trimmers", "scissors", "hairdryers", "hair dryers", "hairdryer"]);
const CONSUMABLES = new Set(["blades", "blade", "bladeoil", "oil", "spray"]);

// Είδος χωρίς παλιά κατηγορία: μαντεύεται από το όνομά του.
const NAME_GUESS = [
  [/wax/i, "Cosmetics", "wax"], [/pomade/i, "Cosmetics", "pomade"], [/shampoo/i, "Cosmetics", "shampoo"],
  [/after ?shave/i, "Cosmetics", "aftershave"], [/beard/i, "Cosmetics", "beard"], [/cream/i, "Cosmetics", "cream"],
  [/clipper/i, "Tools", "clippers"], [/trimmer/i, "Tools", "trimmers"], [/shaver/i, "Tools", "shavers"],
  [/scissor/i, "Tools", "scissors"], [/hair ?dryer/i, "Tools", "hairdryers"],
];
const CONSUMABLE_NAME = /half blade|blade oil|freeze spray|5 in 1|5in1/i;

// Τύπος αναλώσιμου από το όνομα — το "consumables" δεν είναι τύπος, είναι η ίδια η κατηγορία.
function consumableType(name) {
  if (/oil/i.test(name)) return "oil";
  if (/spray/i.test(name)) return "spray";
  if (/blade/i.test(name)) return "blades";
  return "";
}

function classify(p) {
  const cat = norm(p.category);
  const old = String(p.category || "").trim();

  if (CONSUMABLE_NAME.test(p.name) || CONSUMABLES.has(cat)) {
    const sub = CONSUMABLES.has(cat) && cat !== "blade" && cat !== "bladeoil" ? old : consumableType(p.name);
    return { category: "Consumables", subcategory: sub || consumableType(p.name) };
  }
  if (isFinal(old)) {
    // Ήδη σε τελική κατηγορία (π.χ. από την πρώτη αναδιάρθρωση ROVRA): κρατιέται, συμπληρώνεται μόνο η υποκατηγορία.
    let sub = p.subcategory || "";
    if (!sub || norm(sub) === norm(old)) {
      if (norm(old) === "consumables") sub = consumableType(p.name);
      else if (/grip/i.test(p.name)) sub = "grips";
    }
    return { category: finalName(old), subcategory: sub };
  }
  if (COSMETICS.has(cat)) return { category: "Cosmetics", subcategory: old };
  if (TOOLS.has(cat)) return { category: "Tools", subcategory: old };
  if (!cat) {
    const hit = NAME_GUESS.find(([re]) => re.test(p.name));
    if (hit) return { category: hit[1], subcategory: hit[2] };
  }
  return { category: "Accessories", subcategory: old };
}

function main() {
  const apply = process.argv.includes("--apply");
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  const now = new Date().toISOString();

  const barber = (db.products || []).filter((p) => p.department === "barber");
  const groups = {};
  let changed = 0;

  for (const p of barber) {
    const to = classify(p);
    if (p.category === to.category && (p.subcategory || "") === (to.subcategory || "")) continue;
    (groups[to.category] = groups[to.category] || []).push(`${p.name} [${p.brand || "—"}]   ${p.category || "—"}${p.subcategory ? " › " + p.subcategory : ""}  ->  ${to.category} › ${to.subcategory || "—"}`);
    changed++;
    if (apply) { p.category = to.category; p.subcategory = to.subcategory; p.updatedAt = now; }
  }

  for (const cat of FINAL) {
    const n = barber.filter((p) => (apply ? p.category : classify(p).category) === cat).length;
    console.log(`\n${cat}: ${n} products in total (${(groups[cat] || []).length} change)`);
    for (const line of groups[cat] || []) console.log("   ", line);
  }

  // Λίστα κατηγοριών: οι 4 + ό,τι χρησιμοποιείται ακόμα από προϊόντα.
  const stillUsed = new Set((db.products || []).map((p) => (apply ? p.category : (p.department === "barber" ? classify(p).category : p.category))).filter(Boolean));
  const list = db.categories || [];
  const keep = list.filter((c) => isFinal(c.name) ? c.name === finalName(c.name) : stillUsed.has(c.name));
  const removed = list.filter((c) => !keep.includes(c)).map((c) => c.name);
  const toCreate = FINAL.filter((f) => !keep.some((c) => c.name === f));
  console.log(`\nCategory list: keep ${keep.map((c) => c.name).join(", ")}`);
  console.log(`  create: ${toCreate.join(", ") || "(none)"}`);
  console.log(`  remove (no product uses them any more): ${removed.join(", ") || "(none)"}`);
  console.log(`\n${apply ? "Updated" : "Would update"} ${changed} of ${barber.length} barber products.`);

  if (apply) {
    db.categories = [...keep, ...toCreate.map((name) => ({ id: crypto.randomBytes(7).toString("hex").toUpperCase(), name }))];
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE);
    console.log("db.json updated.");
  } else {
    console.log("Dry run only — nothing written. Re-run with --apply to make the change.");
  }
}

main();
