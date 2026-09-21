import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Ανάγνωση τιμολογίου προμηθευτή με ΣΤΗΛΕΣ — για τιμολόγια τύπου
//   ITEM CODE | BARCODE | DESCRIPTION | QTY | PRICE | DIS% | NET | VC | AMOUNT
// (π.χ. Melanico / Eurosoft), ειδικά όταν είναι σκαναρισμένα με κινητό (Adobe Scan).
//
// Γιατί χωριστός αναγνώστης: σε φωτογραφία/σκαναρισμένο PDF το στρωματισμένο κείμενο (OCR) είναι λίγο
// στραβό — τα κομμάτια της ίδιας γραμμής προϊόντος έχουν διαφορά ύψους έως και μισή γραμμή, και όταν
// ομαδώνονται "κατά ύψος" κολλάνε γειτονικές γραμμές μεταξύ τους (η ποσότητα της μιας πέφτει στην άλλη,
// ένα "30%" γίνεται περιγραφή κ.λπ.). Εδώ κάθε στήλη διαβάζεται ΞΕΧΩΡΙΣΤΑ (οι αριθμοί μιας στήλης
// είναι στοιχισμένοι δεξιά στο ίδιο x) και οι στήλες ταιριάζουν μεταξύ τους ΜΕ ΣΕΙΡΑ — η 5η τιμή της
// στήλης Price ανήκει στην 5η γραμμή, όπως και η 5η τιμή της στήλης Amount. Ό,τι λείπει από το OCR
// (π.χ. μια ποσότητα που δεν διαβάστηκε) συμπληρώνεται με αριθμητική: Amount ÷ Price = Ποσότητα.
// Στο τέλος τα αθροίσματα συγκρίνονται με τα σύνολα που γράφει το ίδιο το τιμολόγιο (Net Value / Total).
//
// Επιστρέφει null αν το έγγραφο δεν έχει αυτή τη μορφή (τότε δουλεύουν οι υπόλοιποι αναγνώστες).

const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

function toNum(s) {
  let t = String(s).replace(/[^\d.,-]/g, "");
  if (!/^-?\d+([.,]\d+)?$/.test(t) && !/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

async function readPageTokens(doc, pageNo) {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const toks = [];
  for (const it of tc.items) {
    if (!("str" in it)) continue;
    const s = it.str.trim();
    if (!s) continue;
    const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    toks.push({ s, x, xr: x + (it.width || 0), y });
  }
  page.cleanup();
  return toks;
}

const up = (t) => t.s.toUpperCase().replace(/\s+/g, "");

// Ομαδοποίηση τιμών (δεξιά άκρα στηλών) σε "λωρίδες" όταν η απόσταση μεταξύ γειτονικών ≤ gap.
function clusterByX(tokens, gap) {
  const sorted = [...tokens].sort((a, b) => a.xr - b.xr);
  const clusters = [];
  for (const t of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && t.xr - last.max <= gap) { last.tokens.push(t); last.max = t.xr; }
    else clusters.push({ tokens: [t], min: t.xr, max: t.xr });
  }
  for (const c of clusters) c.tokens.sort((a, b) => a.y - b.y);
  return clusters;
}

// Ταιριάζει τα tokens μιας στήλης (ταξινομημένα κατά y) με τις γραμμές-άγκυρες (ταξινομημένες κατά y),
// ΜΕ ΣΕΙΡΑ (χωρίς διασταυρώσεις): ελάχιστο συνολικό "ύψος-απόκλιση", με δυνατότητα παράλειψης token/γραμμής.
function alignMonotone(tokens, anchors, skip = 5) {
  const n = tokens.length, m = anchors.length;
  const INF = 1e9;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const from = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (dp[i][j] >= INF) continue;
      if (i < n && dp[i][j] + skip < dp[i + 1][j]) { dp[i + 1][j] = dp[i][j] + skip; from[i + 1][j] = 1; }
      if (j < m && dp[i][j] + skip < dp[i][j + 1]) { dp[i][j + 1] = dp[i][j] + skip; from[i][j + 1] = 2; }
      if (i < n && j < m) {
        const d = Math.abs(tokens[i].y - anchors[j].y);
        if (d <= skip * 2 && dp[i][j] + d < dp[i + 1][j + 1]) { dp[i + 1][j + 1] = dp[i][j] + d; from[i + 1][j + 1] = 3; }
      }
    }
  }
  const out = new Array(m).fill(null);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const f = from[i][j];
    if (f === 3) { out[j - 1] = tokens[i - 1]; i--; j--; }
    else if (f === 1) i--;
    else if (f === 2) j--;
    else break;
  }
  return out;
}

const assignColumn = (tokens, anchors) => (tokens.length === anchors.length ? tokens.slice() : alignMonotone(tokens, anchors));

function ean13Check(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

const validEan13 = (d) => /^\d{13}$/.test(d) && Number(d[12]) === ean13Check(d.slice(0, 12));

// Το OCR κόβει συχνά ψηφία από ένα barcode. Επιστρέφει barcode που μπορεί να χρησιμοποιηθεί για ταίριασμα προϊόντος,
// ή null — ένα λάθος barcode είναι χειρότερο από κανένα (θα ταίριαζε λάθος προϊόν).
//   13 ψηφία με σωστό check digit → ΟΚ · 12 ψηφία: έγκυρο UPC-A ή κομμένο EAN (λείπει το check digit → συμπληρώνεται)
//   8 ψηφία (EAN-8) → ΟΚ αν το check digit ταιριάζει · οτιδήποτε άλλο → null
function cleanBarcode(b, eanPrefixes = new Set()) {
  if (!b) return null;
  // 13 ψηφία: κρατιέται όπως διαβάστηκε (η αναγνώριση προϊόντος γίνεται με ακριβή σύγκριση, οπότε ένα λάθος ψηφίο
  // απλώς δεν ταιριάζει με κανένα προϊόν — ενώ ένα barcode με "λάθος" check digit μπορεί να είναι σωστά τυπωμένο).
  if (/^\d{13}$/.test(b)) return b;
  // 12 ψηφία: αν οι άλλες γραμμές του ίδιου τιμολογίου έχουν EAN-13 με το ίδιο πρόθεμα, είναι κομμένο EAN-13
  // (ένα κομμένο EAN μοιάζει "τυχαία" με έγκυρο UPC-A στο 10% των περιπτώσεων).
  if (/^\d{12}$/.test(b)) return eanPrefixes.has(b.slice(0, 6)) || !validEan13("0" + b) ? b + ean13Check(b) : b;
  if (/^\d{8}$/.test(b)) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += Number(b[i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === Number(b[7]) ? b : null;
  }
  return null;
}

// Λάθη OCR σε κωδικούς είδους: "EK3707o" → "EK37070" (το γράμμα o/O ανάμεσα σε ψηφία είναι μηδενικό).
function cleanCode(c) {
  if (!c) return null;
  const m = c.match(/^([A-Za-z]{1,4})([0-9OolI]+)$/);
  if (!m) return c;
  return m[1] + m[2].replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
}

function findHeader(tokens) {
  const qty = tokens.find((t) => up(t) === "QTY" || up(t) === "QUANTITY");
  if (!qty) return null;
  const near = (t) => Math.abs(t.y - qty.y) < 10;
  const amount = tokens.find((t) => ["AMOUNT", "TOTAL", "VALUE"].includes(up(t)) && near(t) && t.x > qty.x);
  const desc = tokens.find((t) => up(t) === "DESCRIPTION" && near(t));
  const barcode = tokens.find((t) => ["BARCODE", "EAN"].includes(up(t)) && near(t));
  if (!amount || !desc) return null;
  return { qty, amount, desc, barcode, y: qty.y };
}

function parsePage(tokens) {
  const hdr = findHeader(tokens);
  if (!hdr) return null;

  // Τέλος πίνακα: υποσέλιδο (VAT Summary / Goods Value) ή σημείωμα λογισμικού "(C) ...".
  const below = tokens.filter((t) => t.y > hdr.y + 30);
  const footerTok = below.filter((t) => /^(goods|summary|less|plus)/i.test(t.s) || /^\(c\)/i.test(t.s) || up(t) === "VATSUMMARY").sort((a, b) => a.y - b.y)[0];
  const vatTok = below.filter((t) => up(t) === "VAT" && t.x < hdr.qty.x - 80).sort((a, b) => a.y - b.y)[0];
  const bodyEnd = Math.min(footerTok ? footerTok.y : Infinity, vatTok ? vatTok.y : Infinity) - 4;
  const body = tokens.filter((t) => t.y > hdr.y + 8 && t.y < bodyEnd);
  const footer = tokens.filter((t) => t.y >= bodyEnd);

  const qtyStart = hdr.qty.x - 30;
  const descStart = hdr.desc.x - 6;
  const barcodeStart = hdr.barcode ? hdr.barcode.x - 16 : null;

  // ---- αριθμητικές στήλες: λωρίδες με ίδιο δεξί άκρο
  const numeric = body.filter((t) => t.x >= qtyStart && /^[\d.,]+%?$/.test(t.s));
  let clusters = clusterByX(numeric, 7).filter((c) => c.tokens.length >= 3);
  if (clusters.length < 3) return null;
  const pctRatio = (c) => c.tokens.filter((t) => t.s.endsWith("%")).length / c.tokens.length;
  const pctIdx = clusters.findIndex((c) => pctRatio(c) >= 0.6);
  const cols = {};
  if (pctIdx >= 2) {
    cols.qty = clusters[pctIdx - 2]; cols.price = clusters[pctIdx - 1]; cols.dis = clusters[pctIdx];
    const after = clusters.slice(pctIdx + 1);
    if (after.length >= 2) { cols.net = after[0]; cols.amount = after[after.length - 1]; }
    else if (after.length === 1) cols.amount = after[0];
  } else {
    cols.qty = clusters[0]; cols.price = clusters[1]; cols.amount = clusters[clusters.length - 1];
  }
  if (!cols.amount || !cols.price) return null;

  // ---- κωδικοί / barcodes / περιγραφή
  const codeTokens = body.filter((t) => t.x < (barcodeStart ?? descStart - 60) && /^[A-Za-z]{1,4}[A-Za-z0-9\-/.]*\d[A-Za-z0-9\-/.]*$/.test(t.s)).sort((a, b) => a.y - b.y);
  const bcBand = (t) => barcodeStart != null && t.x >= barcodeStart && t.x < descStart - 2;
  const bcTokens = body.filter((t) => bcBand(t) && /^\d{6,18}$/.test(t.s)).sort((a, b) => a.y - b.y);
  const stray = body.filter((t) => bcBand(t) && /^\d$/.test(t.s));
  const descTokens = body.filter((t) => t.x >= descStart && t.x < qtyStart - 5);

  // ---- άγκυρες γραμμών: η στήλη με τα περισσότερα tokens (ισοπαλία: barcode, μετά discount, μετά amount)
  const sets = [
    { name: "barcode", list: bcTokens },
    { name: "dis", list: cols.dis ? cols.dis.tokens : [] },
    { name: "amount", list: cols.amount.tokens },
  ];
  const anchorSet = sets.reduce((best, s) => (s.list.length > best.list.length ? s : best), sets[0]);
  const anchors = anchorSet.list;
  if (anchors.length < 2) return null;

  const disCounts = {};
  for (const t of cols.dis ? cols.dis.tokens : []) { const v = toNum(t.s); if (v != null) disCounts[v] = (disCounts[v] || 0) + 1; }
  const modeDis = Object.entries(disCounts).sort((a, b) => b[1] - a[1])[0];
  const usualDiscount = modeDis ? Number(modeDis[0]) : null;

  const colPick = (c) => (c ? assignColumn(c.tokens, anchors) : anchors.map(() => null));
  const qtyCol = colPick(cols.qty), priceCol = colPick(cols.price), disCol = colPick(cols.dis), netCol = colPick(cols.net), amtCol = colPick(cols.amount);
  const bcCol = assignColumn(bcTokens, anchors);
  const codeCol = assignColumn(codeTokens, anchors);

  // ---- περιγραφή: γραμμές (λέξεις με σχεδόν ίδιο y) -> γραμμές πίνακα
  const dsorted = [...descTokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const t of dsorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(t.y - last.y) <= 3) { last.tokens.push(t); last.y = (last.y * (last.tokens.length - 1) + t.y) / last.tokens.length; }
    else lines.push({ y: t.y, tokens: [t] });
  }
  const lineAsTok = lines.map((l) => ({ y: l.y, line: l }));
  const matched = lines.length === anchors.length ? lineAsTok.slice() : alignMonotone(lineAsTok, anchors);
  const rowsDesc = anchors.map(() => []);
  const used = new Set();
  matched.forEach((m, j) => { if (m) { rowsDesc[j].push(m.line); used.add(m.line); } });
  for (const l of lines) {
    if (used.has(l)) continue; // γραμμή περιγραφής που έμεινε ορφανή (π.χ. συνέχεια σε 2η γραμμή): στη πλησιέστερη γραμμή πίνακα
    let bj = 0, bd = Infinity;
    anchors.forEach((a, j) => { const d = Math.abs(a.y - l.y); if (d < bd) { bd = d; bj = j; } });
    rowsDesc[bj].push(l);
  }

  // ---- σύνθεση γραμμών
  const rows = [];
  for (let j = 0; j < anchors.length; j++) {
    const description = rowsDesc[j].sort((a, b) => a.y - b.y)
      .map((l) => l.tokens.sort((a, b) => a.x - b.x).map((t) => t.s).join(" ")).join(" ")
      .replace(/\s+/g, " ").trim();
    let barcode = bcCol[j] ? bcCol[j].s : null;
    if (barcode && barcode.length === 12) {
      // Το OCR κόβει συχνά το τελευταίο ψηφίο του barcode σε ξεχωριστό κομμάτι — ένωσέ το αν ταιριάζει το check digit.
      const s = stray.find((t) => Math.abs(t.y - bcCol[j].y) < 8 && t.x >= bcCol[j].xr - 4);
      if (s && Number(s.s) === ean13Check(barcode)) barcode += s.s;
    }
    const code = cleanCode(codeCol[j] ? codeCol[j].s : null);
    const amount = amtCol[j] ? toNum(amtCol[j].s) : null;
    let price = priceCol[j] ? toNum(priceCol[j].s) : null;
    let disc = disCol[j] ? toNum(disCol[j].s) : (cols.dis ? null : 0);
    const net = netCol[j] ? toNum(netCol[j].s) : null;
    let discAssumed = false;
    let qty = qtyCol[j] ? toNum(qtyCol[j].s) : null;
    if (!description && !barcode && !code) continue;

    let flag = null;
    // Το OCR δεν διάβασε το Dis% αυτής της γραμμής: υπολόγισέ το από το Net (Net = Price × (1 − Dis%)) ή, αν λείπει κι αυτό,
    // χρησιμοποίησε τη συνηθισμένη έκπτωση του τιμολογίου — και σημείωσέ το ως αβέβαιο.
    if (disc == null && cols.dis) {
      const price0 = priceCol[j] ? toNum(priceCol[j].s) : null;
      if (net != null && price0 != null && price0 > 0) { const d = Math.round((1 - net / price0) * 100); if (d >= 0 && d < 100) disc = d; }
      if (disc == null && usualDiscount != null) { disc = usualDiscount; discAssumed = true; }
    }
    const hadQty = qty != null;
    if (price == null && net != null && disc != null && disc < 100) price = round2(net / (1 - disc / 100));
    // Ποσότητα: Amount = Qty × Price. Το OCR δεν διαβάζει πάντα σωστά (ή καθόλου) την ποσότητα — η αριθμητική τη διορθώνει.
    if (price != null && price > 0 && amount != null) {
      const qCalc = Math.round(amount / price);
      const arithOk = qCalc >= 1 && Math.abs(qCalc * price - amount) <= 0.011;
      if (qty == null || Math.abs(qty * price - amount) > 0.011) {
        if (arithOk) { if (qty != null) flag = "qty-corrected"; qty = qCalc; }
        else if (qty == null) { qty = 1; flag = "qty-guessed"; }
        else flag = "qty-unverified";
      }
    } else if (qty == null) { qty = 1; flag = "qty-guessed"; }
    if (price == null && amount != null && qty > 0) price = round2(amount / qty);
    if (price == null) { flag = "no-price"; continue; }

    // Το πραγματικό κόστος μονάδας είναι η τιμή ΜΕΤΑ την έκπτωση (Net). Υπολογίζεται με 4 δεκαδικά ώστε
    // ποσότητα × κόστος να δίνει ακριβώς το Net Value του τιμολογίου (το Net στη στήλη είναι στρογγυλεμένο στα 2).
    // Η έκπτωση στρογγυλοποιείται ΑΝΑ ΓΡΑΜΜΗ (Amount − round(Amount × Dis%)) — έτσι βγαίνει ακριβώς το Net Value του τιμολογίου.
    const disPct = disc != null && disc > 0 && disc < 100 ? disc : 0;
    const gross = amount != null ? amount : round2(qty * price);
    const lineNet = disPct ? round2(gross - round2((gross * disPct) / 100)) : gross;
    const unitCost = disPct ? round4(lineNet / qty) : price;
    if (discAssumed && !flag) flag = "discount-assumed";
    rows.push({ description: description || code || barcode, quantity: qty, unitPrice: unitCost, listPrice: price, discountPercent: disPct, net, amount, lineNet, rawBarcode: barcode || null, code: code || null, flag, hadQty });
  }
  return { rows, footer };
}

// Σύνολα και ΦΠΑ από το υποσέλιδο της τελευταίας σελίδας.
function readFooter(footerTokens) {
  const out = { goods: null, discount: null, net: null, vat: null, total: null, vatRates: {} };
  const right = footerTokens.filter((t) => /^\d[\d,]*\.\d{2}$/.test(t.s)).sort((a, b) => a.y - b.y);
  const vals = right.filter((t) => t.x > 300).map((t) => toNum(t.s));
  for (let i = 0; i + 2 < vals.length; i++) {
    if (Math.abs(vals[i] + vals[i + 1] - vals[i + 2]) <= 0.02 && vals[i + 2] > 0) {
      out.net = vals[i]; out.vat = vals[i + 1]; out.total = vals[i + 2];
      if (i >= 2) { out.goods = vals[i - 2]; out.discount = vals[i - 1]; }
      break;
    }
  }
  // Πίνακας ΦΠΑ: γραμμή "κωδικός  ποσοστό  αξία  ΦΠΑ" (π.χ. "5  19.00  307.48  58.42") αριστερά.
  const left = footerTokens.filter((t) => t.x < 300 && /^[\d.,]+$/.test(t.s)).sort((a, b) => a.y - b.y || a.x - b.x);
  const byLine = [];
  for (const t of left) {
    const last = byLine[byLine.length - 1];
    if (last && Math.abs(t.y - last.y) <= 4) last.t.push(t); else byLine.push({ y: t.y, t: [t] });
  }
  for (const l of byLine) {
    const nums = l.t.sort((a, b) => a.x - b.x).map((t) => t.s);
    if (nums.length >= 4 && /^\d{1,2}$/.test(nums[0]) && /^\d{1,2}([.,]\d+)?$/.test(nums[1])) out.vatRates[nums[0]] = toNum(nums[1]);
  }
  return out;
}

export async function extractColumnInvoice(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const items = [];
  let footer = null;
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const parsed = parsePage(await readPageTokens(doc, p));
      if (!parsed) continue;
      items.push(...parsed.rows);
      const f = readFooter(parsed.footer);
      if (f.total != null || Object.keys(f.vatRates).length) footer = f;
    }
  } finally {
    await doc.destroy();
  }
  if (items.length < 3) return null;

  // Δικλείδα: αν η ποσότητα που διάβασε το OCR ΔΕΝ βγάζει το Amount (Qty × Price = Amount) σε πολλές γραμμές,
  // οι στήλες μάλλον δεν είναι αυτές που υποθέσαμε (άλλη μορφή τιμολογίου) — άφησε τους άλλους αναγνώστες να δουλέψουν.
  const withQty = items.filter((it) => it.hadQty);
  const bad = withQty.filter((it) => it.flag === "qty-corrected" || it.flag === "qty-unverified");
  if (withQty.length >= 5 && bad.length / withQty.length > 0.15) return null;

  // Barcodes: καθαρισμός αφού διαβαστούν ΟΛΕΣ οι σελίδες (το κυρίαρχο πρόθεμα EAN βοηθά στη συμπλήρωση κομμένων barcodes).
  const prefixCount = {};
  for (const it of items) if (it.rawBarcode && validEan13(it.rawBarcode)) prefixCount[it.rawBarcode.slice(0, 6)] = (prefixCount[it.rawBarcode.slice(0, 6)] || 0) + 1;
  const eanPrefixes = new Set(Object.entries(prefixCount).filter(([, n]) => n >= 5).map(([k]) => k));
  for (const it of items) { it.barcode = cleanBarcode(it.rawBarcode, eanPrefixes); delete it.rawBarcode; }

  // ΦΠΑ: αν το τιμολόγιο έχει έναν μόνο συντελεστή, ισχύει για όλες τις γραμμές.
  const rates = footer ? Object.values(footer.vatRates).filter((v) => v != null) : [];
  const vatRate = rates.length === 1 ? rates[0] : null;
  if (vatRate != null) for (const it of items) it.vatRate = vatRate;

  const linesGoods = round2(items.reduce((a, it) => a + (it.amount ?? it.quantity * it.listPrice), 0));
  const linesNet = round2(items.reduce((a, it) => a + round2(it.quantity * it.unitPrice), 0));
  const check = {
    invoiceGoods: footer?.goods ?? null,
    invoiceNet: footer?.net ?? null,
    invoiceVat: footer?.vat ?? null,
    invoiceTotal: footer?.total ?? null,
    linesGoods, linesNet,
    corrected: items.filter((it) => it.flag === "qty-corrected").length,
    uncertain: items.filter((it) => it.flag === "qty-guessed" || it.flag === "qty-unverified" || it.flag === "discount-assumed").length,
  };
  return { items: items.map(({ flag, amount, net, lineNet, hadQty, ...rest }) => rest), check };
}
