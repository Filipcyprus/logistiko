// Αναδιάρθρωση κατηγοριών για τα προϊόντα ROVRA:
//   - η ΤΩΡΙΝΗ κατηγορία κάθε προϊόντος περνάει στην Υποκατηγορία (subcategory)
//   - η Κατηγορία γίνεται μία από τρεις: Tools / Consumables / Accessories
//       Tools       = shavers, clippers, trimmers, scissors, hair dryers
//       Consumables = half blades, blade oil, spray (5 in 1)
//       Accessories = όλα τα υπόλοιπα
//   - οι τρεις κατηγορίες προστίθενται και στη λίστα κατηγοριών (db.categories)
//
// Ασφαλές να ξανατρέξει: ένα προϊόν που έχει ήδη υποκατηγορία δεν ξαναπερνιέται (αλλιώς η δεύτερη
// φορά θα έβαζε "Tools" ως υποκατηγορία).
//
// Χρήση:  node scripts/restructure-rovra-categories.js            (δοκιμή, δεν γράφει τίποτα)
//         node scripts/restructure-rovra-categories.js --apply    (εφαρμογή)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(process.cwd(), "data", "db.json");
const NEW_CATEGORIES = ["Accessories", "Tools", "Consumables"];

const norm = (s) => String(s || "").trim().toLowerCase();

const TOOL_CATEGORIES = new Set(["shavers", "clippers", "trimmers", "scissors", "hairdryers", "hair dryers", "hairdryer"]);
// Είδη αναλωσίμων: "half blades", "oil", "spray 5 in 1" (στα δεδομένα: Freeze Spray).
const CONSUMABLE_NAME = /half blade|blade oil|\boil\b|freeze spray|5 in 1|5in1/i;
// Προϊόν χωρίς κατηγορία: μαντεύεται από το όνομά του ώστε ένα ψαλίδι/κουρευτική να μη πάει σε Αξεσουάρ.
const TOOL_NAME = [
  [/clipper/i, "clippers"], [/trimmer/i, "trimmers"], [/shaver/i, "shavers"],
  [/scissor/i, "scissors"], [/hair ?dryer/i, "hairdryers"],
];

function classify(p) {
  const cat = norm(p.category);
  if (CONSUMABLE_NAME.test(p.name) || cat === "consumables") {
    // Το "Tools" της Half Blades δεν έχει νόημα ως υποκατηγορία Αναλωσίμων — παίρνει "blades".
    const sub = /half blade/i.test(p.name) ? "blades" : (p.category || "");
    return { category: "Consumables", subcategory: sub };
  }
  if (TOOL_CATEGORIES.has(cat)) return { category: "Tools", subcategory: p.category };
  // Χωρίς κατηγορία ΚΑΙ όχι αξεσουάρ ("grips for clipper" δεν είναι κουρευτική).
  if (!cat && !/grip|silicone|stand|case|cover/i.test(p.name)) {
    const hit = TOOL_NAME.find(([re]) => re.test(p.name));
    if (hit) return { category: "Tools", subcategory: hit[1] };
  }
  return { category: "Accessories", subcategory: p.category || "" };
}

function main() {
  const apply = process.argv.includes("--apply");
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  const now = new Date().toISOString();

  const rovra = (db.products || []).filter((p) => norm(p.brand) === "rovra");
  const summary = {};
  let changed = 0;

  for (const p of rovra) {
    if (p.subcategory) { console.log("  (already done, skipped)", p.name); continue; }
    const to = classify(p);
    (summary[to.category] = summary[to.category] || []).push(`${p.name}   [${p.category || "—"} -> ${to.category} › ${to.subcategory || "—"}]`);
    changed++;
    if (apply) { p.category = to.category; p.subcategory = to.subcategory; p.updatedAt = now; }
  }

  for (const cat of ["Tools", "Consumables", "Accessories"]) {
    console.log(`\n${cat} (${(summary[cat] || []).length})`);
    for (const line of summary[cat] || []) console.log("   ", line);
  }

  // Λίστα κατηγοριών: αν υπάρχει ήδη η ίδια κατηγορία με άλλα γράμματα (π.χ. "consumables"), αλλάζει
  // η γραφή της στη νέα αντί να προστεθεί δεύτερη παρόμοια — εκτός αν τη χρησιμοποιεί άλλο brand.
  const list = db.categories || [];
  const toCreate = [];
  const toRename = [];
  for (const n of NEW_CATEGORIES) {
    const existing = list.find((c) => norm(c.name) === norm(n));
    if (!existing) { toCreate.push(n); continue; }
    if (existing.name === n) continue;
    const usedByOthers = (db.products || []).some((p) => norm(p.brand) !== "rovra" && p.category === existing.name);
    if (!usedByOthers) toRename.push([existing, n]);
  }
  console.log(`\nCategories to create in the list: ${toCreate.join(", ") || "(none)"}`);
  if (toRename.length) console.log(`Categories renamed in the list: ${toRename.map(([c, n]) => `${c.name} -> ${n}`).join(", ")}`);
  console.log(`${apply ? "Updated" : "Would update"} ${changed} of ${rovra.length} ROVRA products.`);

  if (apply) {
    db.categories = db.categories || [];
    for (const [c, n] of toRename) c.name = n;
    for (const name of toCreate) db.categories.push({ id: crypto.randomBytes(7).toString("hex").toUpperCase(), name });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE);
    console.log("db.json updated.");
  } else {
    console.log("Dry run only — nothing written. Re-run with --apply to make the change.");
  }
}

main();
