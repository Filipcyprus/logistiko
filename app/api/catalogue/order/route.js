import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { createDoc, updateDoc } from "@/lib/docs";
import { isCatalogueProduct, normalizePhone } from "@/lib/catalogue";

// Παραγγελία από τον δημόσιο κατάλογο. Δεν έχει σύνδεση, γι' αυτό: περιορισμός ανά IP, κρυφό πεδίο
// παγίδα για ρομπότ, αυστηρός έλεγχος (μόνο προϊόντα του καταλόγου, ακέραιες ποσότητες) και οι
// τιμές δεν έρχονται ποτέ από τον πελάτη — η παραγγελία μπαίνει με τιμή 0 και ο ιδιοκτήτης
// συμφωνεί τους όρους (π.χ. παρακαταθήκη) πριν την επιβεβαιώσει.
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 60 * 1000;
const PER_IP = 5;
let globalHits = [];
const GLOBAL_MAX = 60;

function tooMany(ip) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  const mine = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (mine.length >= PER_IP || globalHits.length >= GLOBAL_MAX) { hits.set(ip, mine); return true; }
  mine.push(now); globalHits.push(now); hits.set(ip, mine);
  if (hits.size > 5000) hits.clear();
  return false;
}

const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);

export async function POST(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "catalogue.error" }, { status: 400 }); }

  // Ρομπότ: το κρυφό πεδίο "website" πρέπει να είναι κενό. Απαντάμε "επιτυχία" χωρίς να γράψουμε τίποτα.
  if (body.website) return NextResponse.json({ number: "OK" }, { status: 201 });

  const name = clip(body.name, 120), phone = clip(body.phone, 40), email = clip(body.email, 120), notes = clip(body.notes, 1000);
  if (!name || normalizePhone(phone).length < 6) return NextResponse.json({ error: "catalogue.errRequired" }, { status: 400 });
  if (tooMany(ip)) return NextResponse.json({ error: "catalogue.errTooMany" }, { status: 429 });

  const db = readDB();
  const byId = new Map((db.products || []).filter(isCatalogueProduct).map((p) => [p.id, p]));
  const qtyById = new Map();
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 80) : []) {
    const p = byId.get(it && it.productId);
    const q = Math.floor(Number(it && it.quantity));
    if (!p || !(q >= 1)) continue;
    qtyById.set(p.id, Math.min(99, (qtyById.get(p.id) || 0) + q));
  }
  if (qtyById.size === 0) return NextResponse.json({ error: "catalogue.errEmpty" }, { status: 400 });
  if (qtyById.size > 40) return NextResponse.json({ error: "catalogue.error" }, { status: 400 });

  // Αν το τηλέφωνο ή το email ταιριάζει με υπάρχοντα πελάτη, δένεται η παραγγελία μαζί του.
  const ph = normalizePhone(phone);
  const known = (db.customers || []).find((c) => (ph.length >= 6 && normalizePhone(c.phone) === ph) || (email && c.email && c.email.toLowerCase() === email.toLowerCase()));

  const lines = [...qtyById.entries()].map(([id, quantity]) => ({ p: byId.get(id), quantity }));
  const contact = `[Catalogue] ${name} | ${phone}${email ? " | " + email : ""}`;
  const priceList = lines.map(({ p, quantity }) => `${quantity} x ${p.name} (recommended shop price ${Number(p.retailPrice).toFixed(2)})`).join("; ");
  const doc = createDoc("orders", {
    customerId: known ? known.id : null,
    source: "catalogue",
    notes: [contact, notes, priceList].filter(Boolean).join("\n"),
    items: lines.map(({ p, quantity }) => ({
      productId: p.id, description: p.name, quantity, unit: "pcs", unitPrice: 0, vatRate: 0, discount: 0,
    })),
  });
  if (doc.error) return NextResponse.json({ error: "catalogue.error" }, { status: 400 });
  // Άγνωστος πελάτης: δείξε το όνομα/τηλέφωνο που έδωσε στη λίστα και στη σελίδα της παραγγελίας
  // (χωρίς να φτιάχνεται καρτέλα πελάτη — αυτό το αποφασίζει ο ιδιοκτήτης).
  if (!known) {
    updateDoc("orders", doc.id, { customer: { id: null, name: `${name} (catalogue)`, afm: "", address: "", city: "", phone, email, profession: "" } });
  }
  return NextResponse.json({ number: doc.number }, { status: 201 });
}
