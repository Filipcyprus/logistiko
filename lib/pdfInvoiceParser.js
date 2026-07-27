import { PDFParse } from "pdf-parse";

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
  const findCol = (keywords) => norm.findIndex((h) => keywords.some((k) => h.includes(k)));
  return {
    description: findCol(["description", "item", "product", "περιγραφή", "προϊόν", "είδος"]),
    quantity: findCol(["qty", "quantity", "ποσότητα", "τεμ"]),
    unitPrice: findCol(["unit price", "unitprice", "price", "τιμή", "τιμη"]),
    total: findCol(["total", "amount", "σύνολο", "αξία", "value"]),
    barcode: findCol(["ean", "barcode", "upc", "gtin", "βαρκοντ", "μπαρκοντ", "κωδικός ean"]),
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
    let barcode = cols.barcode !== -1
      ? (row[cols.barcode] || "").toString().trim() || null
      : findBarcodeInRow(row, [cols.description, cols.quantity, cols.unitPrice, cols.total]);

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

    items.push({ description, quantity: qty, unitPrice: price, barcode: barcode || null });
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
  // μία τέτοια γραμμή στο έγγραφο· αλλιώς πέφτουμε πίσω στο πιο χαλαρό pattern.
  const strictRowStartRe = /^\d{1,4}\s+\d{6,18}\s+\S/;
  const looseRowStartRe = /^\d{1,4}\s+\S/;
  const rowStartRe = rawLines.some((l) => strictRowStartRe.test(l)) ? strictRowStartRe : looseRowStartRe;
  // Σελιδοδείκτες τύπου "-- 1 of 3 --" / "Page 1 of 3" δεν περιέχουν καμία από τις λέξεις-κλειδιά
  // θορύβου, αλλά αν προσκολληθούν ως συνέχεια στην τελευταία γραμμή προϊόντος χαλάνε το ταίριασμα
  // των αριθμών στο τέλος (η γραμμή πρέπει να ΤΕΛΕΙΩΝΕΙ σε αριθμούς) — αναγνωρίζονται ξεχωριστά.
  const pageMarkerRe = /^-*\s*\d+\s+of\s+\d+\s*-*$/i;

  const rows = [];
  let current = null;
  for (const line of rawLines) {
    const lower = line.toLowerCase();
    // Δίκτυ ασφαλείας: μια νομική/επεξηγηματική παράγραφος (οποιαδήποτε γλώσσα) είναι συνήθως
    // πολύ πιο μακριά από μια αναδιπλωμένη γραμμή περιγραφής προϊόντος — αν ξεπερνά ~150 χαρακτήρες
    // και δεν μοιάζει με αρχή νέας γραμμής προϊόντος, τη θεωρούμε τέλος πίνακα.
    const isLongParagraph = line.length > 150;
    const isNoise = (NOISE_KEYWORDS.some((k) => lower.includes(k)) || pageMarkerRe.test(line) || isLongParagraph) && !rowStartRe.test(line);
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
    const rowMatch = rowText.match(/^\d{1,4}\s+(.*)$/);
    if (!rowMatch) continue;
    let rest = rowMatch[1].trim();

    let barcode = null;
    const codeMatch = rest.match(/^(\d{6,18})\s+/);
    if (codeMatch) {
      barcode = codeMatch[1];
      rest = rest.slice(codeMatch[0].length).trim();
    } else {
      const embedded = rest.match(/\b(\d{6,18})\b/);
      if (embedded) barcode = embedded[1];
    }

    let description = null, qty = null, unitPrice = null;

    let m = rest.match(re4);
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

    items.push({ description, quantity: qty, unitPrice, barcode });
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

    const textResult = await parser.getText();
    const textItems = itemsFromText(textResult.text || "");
    return { items: textItems, source: "text" };
  } finally {
    await parser.destroy();
  }
}
