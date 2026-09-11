import { PDFParse } from "pdf-parse";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Μοναδικό token που δεν εμφανίζεται ποτέ σε πραγματικό κείμενο τιμολογίου — σηματοδοτεί αλλαγή
// σελίδας μέσα στο ανασυντεθειμένο κείμενο (βλ. extractPositionedText / itemsFromText).
const PAGE_BREAK_MARKER = "PDF_PAGE_BREAK_MARKER";

// PDF από σαρωτές/εφαρμογές OCR (π.χ. Adobe Scan) συχνά αποθηκεύουν το αναγνωρισμένο κείμενο
// ομαδοποιημένο ανά στήλη/περιοχή αντί ανά γραμμή προϊόντος — το απλό parser.getText() του
// pdf-parse απλώς συνενώνει τα text runs με τη σειρά που εμφανίζονται στο εσωτερικό ρεύμα
// περιεχομένου του PDF, που για τέτοια PDF ΔΕΝ είναι η οπτική σειρά ανάγνωσης (βγάζει πρώτα ΟΛΟΥΣ
// τους κωδικούς, μετά ΟΛΑ τα barcodes, μετά ΟΛΕΣ τις περιγραφές κ.ο.κ., κάνοντας αδύνατη την
// ανασύνθεση γραμμών προϊόντος). Εδώ διαβάζουμε τα text runs με τη ΘΕΣΗ τους (x,y) απευθείας από το
// pdfjs-dist (την ίδια βιβλιοθήκη χαμηλού επιπέδου που χρησιμοποιεί εσωτερικά το pdf-parse) και τα
// ομαδοποιούμε σε γραμμές βάσει κοντινού Y, ταξινομώντας κάθε γραμμή βάσει X — αναδημιουργώντας την
// πραγματική οπτική σειρά ανάγνωσης ανεξάρτητα από τη σειρά αποθήκευσης στο PDF.
async function extractPositionedText(buffer) {
  // Node's Buffer IS a Uint8Array subclass, οπότε ένα "instanceof Uint8Array" check από μόνο του δεν
  // αρκεί — το pdfjs-dist απορρίπτει ρητά ένα Buffer instance ζητώντας "καθαρό" Uint8Array.
  // new Uint8Array(buffer) αντιγράφει πάντα σε plain Uint8Array, ό,τι κι αν είναι το buffer.
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  let fullText = "";
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const items = [];
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        items.push({ str: item.str, x, y, height: item.height || 10 });
      }
      items.sort((a, b) => a.y - b.y || a.x - b.x);
      const lines = [];
      let current = null;
      for (const it of items) {
        if (current && Math.abs(it.y - current.y) <= Math.max(3, current.height * 0.6)) {
          current.items.push(it);
        } else {
          current = { y: it.y, height: it.height, items: [it] };
          lines.push(current);
        }
      }
      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        fullText += line.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim() + "\n";
      }
      // Δείκτης αλλαγής σελίδας — χωρίς αυτόν, η τελευταία γραμμή προϊόντος μιας σελίδας μπορεί να
      // "μαζέψει" σαν συνέχεια την επικεφαλίδα (λογότυπο/στοιχεία προμηθευτή) της επόμενης σελίδας,
      // χαλώντας την ποσότητα/τιμή της (π.χ. ένα τηλέφωνο "22270025" να διαβαστεί ως ποσότητα).
      // Απλό "\f" δεν αρκεί — το trim() το αφαιρεί σαν whitespace πριν καν φτάσει στον κώδικα
      // ανασύνθεσης γραμμών, οπότε χρειάζεται ένα αναγνωρίσιμο, μη κενό token.
      fullText += `${PAGE_BREAK_MARKER}\n`;
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return fullText;
}

// Μετατρέπει ένα αριθμητικό string (ελληνικό/ευρωπαϊκό ή αγγλικό format) σε Number.
// π.χ. "1.234,56" -> 1234.56, "1,234.56" -> 1234.56, "45,00" -> 45.00
function parseNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[€$£\s]/g, "").trim();
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const afterLastComma = s.slice(s.lastIndexOf(",") + 1);
    s = afterLastComma.length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const NOISE_KEYWORDS = [
  "invoice", "subtotal", "total", "vat", "tax", "date", "page", "iban", "swift", "bank",
  "address", "phone", "email", "tel", "www", "http", "customer", "supplier", "balance",
  "τιμολόγιο", "σύνολο", "φπα", "ημερομηνία", "πελάτης", "προμηθευτής", "διεύθυνση", "τηλέφωνο",
  // Ρουμανικά τιμολόγια συχνά έχουν μια νομική δήλωση συμμόρφωσης μετά τον πίνακα προϊόντων —
  // αυτή πρέπει να αναγνωρίζεται σαν "θόρυβος" (τέλος πίνακα), αλλιώς κολλάει στην τελευταία
  // γραμμή προϊόντος και χαλάει το ταίριασμα αριθμών, χάνοντας ολόκληρη την τελευταία γραμμή.
  "declaratie", "conformitate", "inregistrat", "registrul comertului", "raspundere",
  "sediul", "prevederilor", "producatorilor", "instructiunile", "depozitare", "prescriptiilor",
];

function isNoiseRow(cells) {
  const joined = cells.join(" ").toLowerCase();
  if (!joined.trim()) return true;
  const alpha = joined.replace(/[^a-zα-ω]/gi, "");
  if (alpha.length < 2) return true;
  return false;
}

function detectColumns(headerCells) {
  const norm = headerCells.map((h) => (h || "").toString().toLowerCase().trim());
  const findCol = (keywords, excludeIdx = []) =>
    norm.findIndex((h, i) => !excludeIdx.includes(i) && keywords.some((k) => h.includes(k)));
  const barcode = findCol(["ean", "barcode", "upc", "gtin", "βαρκοντ", "μπαρκοντ", "κωδικός ean", "κωδικος ean"]);
  // Ο κωδικός είδους του προμηθευτή (SKU/part no) είναι συχνά αλφαριθμητικός, όχι μόνο ψηφία σαν
  // το EAN/barcode — ξεχωριστή στήλη ώστε να ταιριάζει με sku/code του προϊόντος στο Logistiko.
  // Πρέπει να εντοπίζεται ΠΡΙΝ την περιγραφή, αλλιώς μια επικεφαλίδα "Item Code" παρερμηνεύεται σαν
  // στήλη περιγραφής (περιέχει τη λέξη "item").
  const code = findCol(
    ["item code", "item no", "item #", "product code", "part no", "part number", "part#", "cat no",
      "catalogue no", "catalog no", "reference", "ref.", "ref no", "sku", "code", "κωδικός είδους",
      "κωδικός προϊόντος", "κωδ. είδους", "κωδικός"],
    [barcode].filter((i) => i !== -1)
  );
  const description = findCol(["description", "item", "product", "περιγραφή", "προϊόν", "είδος"], [barcode, code].filter((i) => i !== -1));
  return {
    description,
    quantity: findCol(["qty", "quantity", "ποσότητα", "τεμ"]),
    unitPrice: findCol(["unit price", "unitprice", "price", "τιμή", "τιμη"]),
    total: findCol(["total", "amount", "σύνολο", "αξία", "value"]),
    barcode,
    code,
  };
}

// Αναγνωρίζει barcode/EAN/κωδικό προμηθευτή σε ένα κελί. Δεν περιοριζόμαστε στα τυπικά μήκη
// EAN-8/UPC-A/EAN-13/GTIN-14 (8/12-14 ψηφία) — πολλοί προμηθευτές βάζουν δικούς τους αριθμητικούς
// κωδικούς με άλλο μήκος (π.χ. 15 ψηφία), οπότε δεχόμαστε οποιαδήποτε αμιγώς αριθμητική ακολουθία
// 6-18 ψηφίων (αρκετά μεγάλη ώστε να μην μπερδεύεται με ποσότητα/τιμή).
function looksLikeBarcode(cell) {
  const s = (cell || "").toString().trim();
  return /^\d{6,18}$/.test(s);
}

// Ένας κωδικός είδους προμηθευτή σε γραμμή απλού κειμένου (χωρίς στήλες) είναι συνήθως ένα
// αλφαριθμητικό token (π.χ. "BL-G2-5-LB", "STM641/56") — όχι απλή λέξη περιγραφής. Απαιτούμε
// να περιέχει ΚΑΙ γράμμα ΚΑΙ ψηφίο ώστε να μην "καταπιεί" την πρώτη λέξη μιας κανονικής περιγραφής.
function looksLikeSupplierCode(token) {
  if (!token || !/^[A-Za-z0-9][A-Za-z0-9\-/.]{2,19}$/.test(token)) return false;
  return /\d/.test(token) && /[A-Za-z]/.test(token);
}

function findBarcodeInRow(row, usedCols) {
  for (let i = 0; i < row.length; i++) {
    if (usedCols.includes(i)) continue;
    if (looksLikeBarcode(row[i])) return row[i].toString().trim();
  }
  return null;
}

// Κάποιοι προμηθευτές γράφουν τον κωδικό EAN/barcode ΜΕΣΑ στο ίδιο κελί με την περιγραφή
// του προϊόντος (π.χ. "123456789012345 Riwayah Amalfi 100ml"), όχι σε ξεχωριστή στήλη.
// Εντοπίζει μια αριθμητική ακολουθία 6-18 ψηφίων μέσα στο κείμενο και επιστρέφει
// { barcode, cleanedDescription } — η περιγραφή καθαρίζεται από τον κωδικό για ευανάγνωστο όνομα.
function extractBarcodeFromDescription(description) {
  const m = description.match(/\b(\d{6,18})\b/);
  if (!m) return { barcode: null, cleanedDescription: description };
  const cleaned = (description.slice(0, m.index) + description.slice(m.index + m[1].length))
    .replace(/\(\s*\)/g, " ") // κενές παρενθέσεις που έμειναν μετά την αφαίρεση του κωδικού
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–,:]+|[\s\-–,:]+$/g, "")
    .trim();
  return { barcode: m[1], cleanedDescription: cleaned || description };
}

function itemsFromTable(table) {
  if (!table || table.length < 2) return [];
  const cols = detectColumns(table[0]);
  if (cols.description === -1) return [];

  const items = [];
  for (const row of table.slice(1)) {
    if (isNoiseRow(row)) continue;
    let description = (row[cols.description] || "").toString().trim();
    if (!description) continue;

    const quantity = cols.quantity !== -1 ? parseNumber(row[cols.quantity]) : null;
    const unitPrice = cols.unitPrice !== -1 ? parseNumber(row[cols.unitPrice]) : null;
    const total = cols.total !== -1 ? parseNumber(row[cols.total]) : null;
    const code = cols.code !== -1 ? (row[cols.code] || "").toString().trim() || null : null;
    let barcode = cols.barcode !== -1
      ? (row[cols.barcode] || "").toString().trim() || null
      : findBarcodeInRow(row, [cols.description, cols.quantity, cols.unitPrice, cols.total, cols.code]);

    if (!barcode) {
      const extracted = extractBarcodeFromDescription(description);
      if (extracted.barcode) {
        barcode = extracted.barcode;
        description = extracted.cleanedDescription;
      }
    }

    // Αν δεν εντοπίστηκε στήλη ποσότητας (π.χ. λόγω ασυνήθιστης/κατεστραμμένης επικεφαλίδας
    // στη γραφηματοσειρά του PDF), προσπάθησε να την υπολογίσεις από Αξία ÷ Τιμή μονάδας
    // πριν καταλήξεις στην προεπιλογή 1 — αλλιώς χάνεται η πραγματική ποσότητα σιωπηλά.
    let qty = quantity;
    let price = unitPrice;
    if (qty == null && total != null && price != null && price > 0) {
      qty = Math.round((total / price) * 100) / 100;
    }
    if (price == null && total != null && qty != null && qty > 0) {
      price = Math.round((total / qty) * 100) / 100;
    }
    if (qty == null) qty = 1;
    if (price == null) continue;

    items.push({ description, quantity: qty, unitPrice: price, barcode: barcode || null, code: code || null });
  }
  return items;
}

// Εναλλακτική εξαγωγή από απλό κείμενο, όταν δεν εντοπίστηκε πίνακας (π.χ. το PDF δεν έχει
// ορατά περιγράμματα κελιών — πολύ συχνό σε πραγματικά τιμολόγια). Πολλά τιμολόγια γράφουν
// κάθε γραμμή προϊόντος ως "α/α  [κωδικός]  περιγραφή  [μονάδα]  ποσότητα  τιμή  αξία  ΦΠΑ",
// όπου η περιγραφή συχνά αναδιπλώνεται σε 2-3 φυσικές γραμμές κειμένου. Πρώτα ανασυνθέτουμε
// τις λογικές γραμμές (μια νέα γραμμή προϊόντος ξεκινά όταν το κείμενο αρχίζει με αριθμό α/α),
// μετά δοκιμάζουμε να ταιριάξουμε 4, 3 ή 2 αριθμούς στο τέλος (ποσότητα, τιμή μονάδας, αξία, ΦΠΑ).
function itemsFromText(text) {
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // Μια αναδιπλωμένη γραμμή περιγραφής μπορεί τυχαία να ξεκινάει με αριθμό (π.χ. "7200 RPM",
  // "500 ML" — προδιαγραφή προϊόντος, όχι α/α γραμμής), μπερδεύοντας ένα απλό pattern "αριθμός +
  // κείμενο". Προτιμάμε το αυστηρότερο pattern "α/α + κωδικός 6-18 ψηφίων" όταν υπάρχει έστω και
  // μία τέτοια γραμμή στο έγγραφο. Πολλά τιμολόγια όμως δεν έχουν καθόλου ξεχωριστή στήλη α/α —
  // κάθε γραμμή ξεκινά ΚΑΤΕΥΘΕΙΑΝ με τον κωδικό είδους (π.χ. "110195 5902308702981 NON-STICKY...").
  // Δεχόμαστε αυτό το pattern μόνο αν αρκετές γραμμές ταιριάζουν ΚΑΙ ο πρώτος "κωδικός" τους περιέχει
  // ψηφίο, αλλιώς θα ταίριαζε σχεδόν κάθε πρόταση που ξεκινά με μια λέξη.
  const strictRowStartRe = /^\d{1,4}\s+\d{6,18}\s+\S/;
  const looseRowStartRe = /^\d{1,4}\s+\S/;
  const codeRowStartRe = /^([A-Za-z0-9][A-Za-z0-9\-/.]{2,19})\s+\S/;
  const isCodeRowStart = (l) => {
    const m = l.match(codeRowStartRe);
    return !!m && /\d/.test(m[1]);
  };
  let mode = "loose";
  if (rawLines.some((l) => strictRowStartRe.test(l))) mode = "strict";
  else if (rawLines.filter(isCodeRowStart).length >= 3) mode = "code";
  const rowStartRe = {
    test: (l) => (mode === "strict" ? strictRowStartRe.test(l) : mode === "code" ? isCodeRowStart(l) : looseRowStartRe.test(l)),
  };
  // Σελιδοδείκτες τύπου "-- 1 of 3 --" / "Page 1 of 3" δεν περιέχουν καμία από τις λέξεις-κλειδιά
  // θορύβου, αλλά αν προσκολληθούν ως συνέχεια στην τελευταία γραμμή προϊόντος χαλάνε το ταίριασμα
  // των αριθμών στο τέλος (η γραμμή πρέπει να ΤΕΛΕΙΩΝΕΙ σε αριθμούς) — αναγνωρίζονται ξεχωριστά.
  const pageMarkerRe = /^-*\s*\d+\s+of\s+\d+\s*-*$/i;
  // Σημείωση πνευματικών δικαιωμάτων λογισμικού τιμολόγησης (π.χ. "(C) Eurosoft Business
  // Software-77777013") — δεν περιέχει καμία λέξη-κλειδί θορύβου, αλλά αν προσκολληθεί ως συνέχεια
  // της τελευταίας γραμμής προϊόντος (συνήθως ακριβώς πριν την αλλαγή σελίδας) χαλάει το ταίριασμα
  // των αριθμών στο τέλος της.
  const copyrightRe = /^\(c\)|^©/i;

  const rows = [];
  let current = null;
  for (const line of rawLines) {
    // Αλλαγή σελίδας — έκλεισε ό,τι μαζευόταν ΤΩΡΑ, πριν αρχίσει να "μαζεύει" σαν συνέχεια την
    // επικεφαλίδα/λογότυπο της επόμενης σελίδας (βλ. σχόλιο στο extractPositionedText).
    if (line === PAGE_BREAK_MARKER) {
      if (current) { rows.push(current); current = null; }
      continue;
    }
    const lower = line.toLowerCase();
    // Δίκτυ ασφαλείας: μια νομική/επεξηγηματική παράγραφος (οποιαδήποτε γλώσσα) είναι συνήθως
    // πολύ πιο μακριά από μια αναδιπλωμένη γραμμή περιγραφής προϊόντος — αν ξεπερνά ~150 χαρακτήρες
    // και δεν μοιάζει με αρχή νέας γραμμής προϊόντος, τη θεωρούμε τέλος πίνακα.
    const isLongParagraph = line.length > 150;
    const isNoise = (NOISE_KEYWORDS.some((k) => lower.includes(k)) || pageMarkerRe.test(line) || copyrightRe.test(line) || isLongParagraph) && !rowStartRe.test(line);
    if (rowStartRe.test(line)) {
      if (current) rows.push(current);
      current = line;
    } else if (isNoise) {
      if (current) { rows.push(current); current = null; }
    } else if (current) {
      current += " " + line;
    }
  }
  if (current) rows.push(current);

  const NUM = "[\\d.,]+";
  const UNIT_WORD = "[A-Za-zΑ-Ωα-ω]{2,12}";
  const re4 = new RegExp(`^(.+?)\\s+(?:${UNIT_WORD}\\s+)?(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})$`);
  const re3 = new RegExp(`^(.+?)\\s+(?:${UNIT_WORD}\\s+)?(${NUM})\\s+(${NUM})\\s+(${NUM})$`);
  const re2 = new RegExp(`^(.+?)\\s+(?:${UNIT_WORD}\\s+)?(${NUM})\\s+(${NUM})$`);

  const items = [];
  for (const rowText of rows) {
    let rest, barcode = null, code = null;
    if (mode === "code") {
      // Δεν υπάρχει α/α να αφαιρεθεί — η γραμμή ξεκινά κατευθείαν με τον κωδικό είδους, συνήθως
      // ακολουθούμενο από ξεχωριστή στήλη barcode/EAN (π.χ. "110195 5902308702981 NON-STICKY...").
      const codeTok = rowText.match(/^(\S+)\s+/);
      if (!codeTok) continue;
      code = codeTok[1];
      rest = rowText.slice(codeTok[0].length).trim();
      const barcodeTok = rest.match(/^(\d{6,18})\s+/);
      if (barcodeTok) {
        barcode = barcodeTok[1];
        rest = rest.slice(barcodeTok[0].length).trim();
      }
    } else {
      const rowMatch = rowText.match(/^\d{1,4}\s+(.*)$/);
      if (!rowMatch) continue;
      rest = rowMatch[1].trim();

      const codeMatch = rest.match(/^(\d{6,18})\s+/);
      if (codeMatch) {
        barcode = codeMatch[1];
        rest = rest.slice(codeMatch[0].length).trim();
      } else {
        const embedded = rest.match(/\b(\d{6,18})\b/);
        if (embedded) barcode = embedded[1];
        const firstToken = rest.split(/\s+/)[0];
        if (looksLikeSupplierCode(firstToken)) {
          code = firstToken;
          rest = rest.slice(firstToken.length).trim();
        }
      }
    }

    let description = null, qty = null, unitPrice = null;

    // Τιμολόγια με πολλές επιπλέον στήλες μετά την ποσότητα/τιμή (π.χ. "QTY PRICE DIS% NET VC
    // AMOUNT") μπερδεύουν τα re4/re3/re2 — αυτά υποθέτουν ότι οι 2-4 ΤΕΛΕΥΤΑΙΟΙ αριθμοί της γραμμής
    // είναι ποσότητα/τιμή/σύνολο, αλλά εδώ δεν είναι. Αν εντοπιστούν 5+ αριθμητικά-σαν tokens στη
    // σειρά προς το τέλος, προτιμάμε τους ΠΡΩΤΟΥΣ δύο αυτοτελείς αριθμούς ΜΕΤΑ την περιγραφή
    // (ποσότητα, τιμή μονάδας) αντί των τελευταίων.
    const restTokens = rest.split(/\s+/);
    const NUMISH_TOKEN = /^[\d.,]+%?$/;
    let trailingNumericCount = 0;
    for (let i = restTokens.length - 1; i >= 0 && NUMISH_TOKEN.test(restTokens[i]); i--) trailingNumericCount++;
    if (trailingNumericCount >= 5) {
      const PURE_NUM = /^\d+([.,]\d+)?$/;
      for (let i = 0; i < restTokens.length - 1; i++) {
        if (PURE_NUM.test(restTokens[i]) && PURE_NUM.test(restTokens[i + 1])) {
          const desc = restTokens.slice(0, i).join(" ").trim();
          const q = parseNumber(restTokens[i]), up = parseNumber(restTokens[i + 1]);
          if (desc && q != null && q > 0 && up != null) { description = desc; qty = q; unitPrice = up; }
          break;
        }
      }
    }

    let m = qty == null ? rest.match(re4) : null;
    if (m) {
      const q = parseNumber(m[2]), up = parseNumber(m[3]), val = parseNumber(m[4]);
      if (q && up != null && val != null && Math.abs(q * up - val) < Math.max(0.5, val * 0.05)) {
        description = m[1].trim(); qty = q; unitPrice = up;
      }
    }
    if (qty == null) {
      m = rest.match(re3);
      if (m) {
        const q = parseNumber(m[2]), up = parseNumber(m[3]), tot = parseNumber(m[4]);
        if (q && up != null && tot != null && Math.abs(q * up - tot) < Math.max(0.5, tot * 0.05)) {
          description = m[1].trim(); qty = q; unitPrice = up;
        }
      }
    }
    if (qty == null) {
      m = rest.match(re2);
      if (m) {
        const a = parseNumber(m[2]), b = parseNumber(m[3]);
        if (a != null && b != null && a > 0) {
          description = m[1].trim(); qty = a; unitPrice = Math.round((b / a) * 100) / 100;
        }
      }
    }
    if (qty == null || !description) continue;

    items.push({ description, quantity: qty, unitPrice, barcode, code });
  }
  return items;
}

// Εξάγει πιθανές γραμμές παραστατικού από ένα PDF προμηθευτή. Best-effort —
// τα αποτελέσματα προορίζονται για έλεγχο/διόρθωση από τον χρήστη πριν αποθηκευτούν.
export async function extractInvoiceItems(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const tableResult = await parser.getTable();
    const tableItems = (tableResult.pages || [])
      .flatMap((p) => p.tables || [])
      .flatMap((t) => itemsFromTable(t));
    if (tableItems.length > 0) {
      return { items: tableItems, source: "table" };
    }

    // Προτίμησε την ανασύνθεση κειμένου βάσει ΘΕΣΗΣ (βλ. σχόλιο του extractPositionedText) — πιάνει
    // σωστά και PDF από σαρωτές/OCR όπου το απλό getText() βγαίνει σε λάθος σειρά. Για κανονικά PDF
    // (κείμενο ήδη σε φυσική σειρά ανάγνωσης) δίνει ουσιαστικά το ίδιο αποτέλεσμα.
    try {
      const positionedText = await extractPositionedText(buffer);
      const positionedItems = itemsFromText(positionedText);
      if (positionedItems.length > 0) {
        return { items: positionedItems, source: "text" };
      }
    } catch (e) {
      console.error("Αποτυχία ανασύνθεσης κειμένου βάσει θέσης, fallback σε απλό getText():", e);
    }

    const textResult = await parser.getText();
    const textItems = itemsFromText(textResult.text || "");
    return { items: textItems, source: "text" };
  } finally {
    await parser.destroy();
  }
}
