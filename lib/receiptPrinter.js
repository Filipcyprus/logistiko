"use client";

// Αυτόματη εκτύπωση απόδειξης σε θερμικό εκτυπωτή μέσω QZ Tray — ένα δωρεάν τοπικό
// πρόγραμμα-γέφυρα που πρέπει να τρέχει στον ΙΔΙΟ υπολογιστή με τον εκτυπωτή/browser.
// Χωρίς πιστοποιητικό υπογραφής (ανυπόγραφη σύνδεση): το QZ Tray θα ρωτήσει "Allow?" την
// πρώτη φορά — τσέκαρε "Remember this decision" εκεί για να μη ρωτάει ξανά.
// https://qz.io
//
// Η σύνδεση ΠΑΡΑΜΕΝΕΙ ανοιχτή μετά από κάθε εκτύπωση (δεν κάνουμε disconnect) και
// ξαναχρησιμοποιείται σε κάθε επόμενη πώληση μέσα στην ίδια καρτέλα/session — αν έκλεινε
// μετά από κάθε απόδειξη, θα χρειαζόταν νέο "Allow?" ΣΕ ΚΑΘΕ πώληση (το QZ Tray δεν το
// θυμάται αξιόπιστα λόγω γνωστού bug στο "Remember this decision"), κάτι που σε πραγματική
// χρήση σημαίνει σιωπηλή αποτυχία εκτύπωσης μόλις ο ταμίας δεν προλάβει να το εγκρίνει.

let qzModulePromise = null;
function loadQz() {
  if (!qzModulePromise) qzModulePromise = import("qz-tray").then((m) => m.default || m);
  return qzModulePromise;
}

// Αν ο εκτυπωτής/QZ Tray είναι σε ΑΛΛΟΝ υπολογιστή από αυτόν που κάνει την πώληση, χρειάζεται
// το IP εκείνου του υπολογιστή στο δίκτυο (Ρυθμίσεις > Εκτυπωτής αποδείξεων > Host) — αλλιώς
// το "localhost" σημαίνει μόνο "αυτός εδώ ο υπολογιστής" και ποτέ δεν θα βρει το QZ Tray.
// Παραμένει secure (wss://) — το Logistiko φορτώνει πάντα με https://, και οι browsers μπλοκάρουν
// ανασφαλές ws:// (mixed content) από σελίδα https. Χρειάζεται πιστοποιητικό στο QZ Tray του
// άλλου υπολογιστή, δημιουργημένο για το IP/hostname του (βλ. οδηγίες στις Ρυθμίσεις).
// Αν δύο κλήσεις (π.χ. το "ζέσταμα" στο άνοιγμα του ταμείου ΚΑΙ μια πραγματική πώληση λίγο
// μετά) ζητήσουν σύνδεση ταυτόχρονα, πρέπει να περιμένουν ΤΗΝ ΙΔΙΑ προσπάθεια σύνδεσης, όχι να
// ανοίξουν η καθεμιά τη δική της — αλλιώς μπορεί η μία να "κλέψει"/μπερδέψει το popup "Allow?"
// της άλλης, με αποτέλεσμα και οι δύο να αποτύχουν με "unable to establish connection".
let connectingPromise = null;
async function ensureConnected(qz, settings) {
  if (qz.websocket.isActive()) return;
  if (connectingPromise) return connectingPromise;
  const host = (settings?.receiptPrinter?.host || "").trim();
  connectingPromise = qz.websocket.connect(host ? { host } : undefined).finally(() => {
    connectingPromise = null;
  });
  return connectingPromise;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Χτίζει το HTML περιεχόμενο της απόδειξης — απλό, μονόχωρο (monospace), χωρίς χρώματα,
// σε πλάτος που ταιριάζει στο ρολό χαρτιού (58mm ή 80mm).
function buildReceiptHtml({ invoice, settings }) {
  const cur = settings.currency || "€";
  const widthMm = Number(settings.receiptPrinter?.widthMm) || 80;
  const money = (n) => Number(n || 0).toFixed(2) + " " + cur;
  const dt = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
  const dateStr = dt.toLocaleDateString();
  const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const rows = (invoice.items || []).map((it) => {
    const qty = Number(it.quantity);
    const price = Number(it.unitPrice);
    const disc = Number(it.discount || 0);
    const lineTotal = qty * price * (1 - disc / 100) * (1 + Number(it.vatRate || 0) / 100);
    return `
      <div style="display:flex;justify-content:space-between;">
        <span>${esc(it.description)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#000;">
        <span>${qty} ${esc(it.unit || "")} x ${money(price)}${disc > 0 ? ` (-${disc}%)` : ""}</span>
        <span>${money(lineTotal)}</span>
      </div>`;
  }).join("");

  const payLabel = { cash: "Cash", card: "Card", bank: "Bank transfer", cheque: "Cheque" }[invoice.paymentMethod] || invoice.paymentMethod || "";

  return `<html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: "Courier New", monospace; font-size: 12px; width: ${widthMm}mm; margin: 0; padding: 2mm 3mm; color: #000; }
    .center { text-align: center; }
    .line { border-top: 1px dashed #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; }
    .bold { font-weight: bold; }
  </style></head><body>
    <div class="center bold">${esc(settings.companyName || "")}</div>
    ${invoice.shopName ? `<div class="center">${esc(invoice.shopName)}</div>` : ""}
    ${settings.address || settings.city ? `<div class="center">${esc([settings.address, settings.city].filter(Boolean).join(", "))}</div>` : ""}
    ${settings.phone ? `<div class="center">${esc(settings.phone)}</div>` : ""}
    ${settings.afm ? `<div class="center">VAT: ${esc(settings.afm)}</div>` : ""}
    <div class="line"></div>
    <div class="row"><span>${esc(invoice.number)}</span><span>${dateStr} ${timeStr}</span></div>
    ${invoice.customer?.name ? `<div>${esc(invoice.customer.name)}</div>` : ""}
    <div class="line"></div>
    ${rows}
    <div class="line"></div>
    <div class="row"><span>Net</span><span>${money(invoice.net)}</span></div>
    <div class="row"><span>VAT</span><span>${money(invoice.vat)}</span></div>
    <div class="row bold"><span>TOTAL</span><span>${money(invoice.total)}</span></div>
    ${payLabel ? `<div class="row"><span>Payment</span><span>${esc(payLabel)}</span></div>` : ""}
    <div class="line"></div>
    ${settings.footerNote ? `<div class="center">${esc(settings.footerNote)}</div>` : ""}
  </body></html>`;
}

// Χτίζει το HTML περιεχόμενο μιας Ζ αναφοράς (ημερήσιας/μηνιαίας) στο ίδιο στενό, μονόχωρο
// στυλ με τις αποδείξεις — για εκτύπωση στον ίδιο θερμικό εκτυπωτή (ρολό), όχι σε κανονικό
// εκτυπωτή γραφείου. Δεν περιλαμβάνει τη λίστα αποδείξεων/ημερών (πολύ μεγάλη για ρολό) —
// αυτή υπάρχει ήδη στην οθόνη/εκτύπωση browser για λεπτομερή έλεγχο.
const PAYMENT_LABELS = { cash: "Cash", card: "Card", bank: "Bank transfer", cheque: "Cheque" };

function buildZReportHtml({ report, mode, settings }) {
  const cur = settings.currency || "€";
  const widthMm = Number(settings.receiptPrinter?.widthMm) || 80;
  const money = (n) => Number(n || 0).toFixed(2) + " " + cur;
  const now = new Date();

  const vatRows = (report.byVatRate || []).map((x) => `
    <div class="row"><span>${x.rate}% Net ${money(x.net)}</span><span>${money(x.gross)}</span></div>`).join("");

  const methodRows = (report.byPaymentMethod || []).map((x) => `
    <div class="row"><span>${esc(PAYMENT_LABELS[x.method] || x.method)} (${x.count})</span><span>${money(x.total)}</span></div>`).join("");

  return `<html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: "Courier New", monospace; font-size: 12px; width: ${widthMm}mm; margin: 0; padding: 2mm 3mm; color: #000; }
    .center { text-align: center; }
    .line { border-top: 1px dashed #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; }
    .bold { font-weight: bold; }
  </style></head><body>
    <div class="center bold">${esc(settings.companyName || "")}</div>
    ${settings.address || settings.city ? `<div class="center">${esc([settings.address, settings.city].filter(Boolean).join(", "))}</div>` : ""}
    ${settings.afm ? `<div class="center">VAT: ${esc(settings.afm)}</div>` : ""}
    <div class="line"></div>
    <div class="center bold">Z REPORT — ${mode === "month" ? "MONTHLY" : "DAILY"}</div>
    <div class="center">Period: ${esc(report.period)}</div>
    <div class="center">Printed: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    <div class="line"></div>
    <div class="row"><span>Receipts</span><span>${report.count}</span></div>
    <div class="row"><span>Net</span><span>${money(report.net)}</span></div>
    <div class="row"><span>VAT</span><span>${money(report.vat)}</span></div>
    <div class="row bold"><span>TOTAL</span><span>${money(report.total)}</span></div>
    <div class="line"></div>
    <div class="bold">By VAT rate</div>
    ${vatRows || "<div>—</div>"}
    <div class="line"></div>
    <div class="bold">By payment method</div>
    ${methodRows || "<div>—</div>"}
    <div class="line"></div>
  </body></html>`;
}

// Τυπική εντολή ESC/POS "άνοιξε το συρτάρι" (kick-out) — δουλεύει σε όλους σχεδόν τους θερμικούς
// εκτυπωτές (Bixolon συμπεριλαμβανομένου) όταν το συρτάρι είναι καλωδιωμένο ΜΕΣΩ του εκτυπωτή
// (θύρα RJ11/RJ12 στο πίσω μέρος), όχι απευθείας σε usb/serial. ESC p 0 25 250.
const OPEN_DRAWER_HEX = "1B700019FA";

async function sendToPrinter(html, settings, extraJobs = []) {
  const printerName = settings.receiptPrinter?.name;
  if (!printerName) return { ok: false, error: "no-printer-configured" };
  const widthMm = Number(settings.receiptPrinter?.widthMm) || 80;

  const qz = await loadQz();
  const attempt = async () => {
    await ensureConnected(qz, settings);
    const config = qz.configs.create(printerName, { units: "mm", size: { width: widthMm }, margins: 0, scaleContent: true });
    await qz.print(config, [...extraJobs, { type: "pixel", format: "html", flavor: "plain", data: html }]);
  };

  try {
    await attempt();
    return { ok: true };
  } catch (e) {
    // Η σύνδεση που κρατάμε ανοιχτή μπορεί να έχει "μπαγιατέψει" (π.χ. έκλεισε το QZ Tray, ή ο
    // υπολογιστής κοιμήθηκε) — το qz-tray τη νομίζει ακόμα ενεργή αλλά η αποστολή αποτυγχάνει
    // (τυπικά σφάλμα: "...send... is not a function"). Ανάγκασε πλήρη επανασύνδεση και δοκίμασε
    // ΜΙΑ ακόμα φορά πριν τα παρατήσεις — έτσι ένα μπαγιάτικο socket δεν χρειάζεται χειροκίνητο
    // refresh της σελίδας για να ξαναδουλέψει η εκτύπωση.
    try {
      try { if (qz.websocket.isActive()) await qz.websocket.disconnect(); } catch { /* ήδη νεκρή */ }
      await attempt();
      return { ok: true };
    } catch (e2) {
      return { ok: false, error: e2?.message || String(e2) };
    }
  }
  // Σκόπιμα ΔΕΝ κάνουμε disconnect εδώ — η σύνδεση μένει ανοιχτή για την επόμενη πώληση.
}

// "Ζεσταίνει" τη σύνδεση με το QZ Tray όταν ανοίγει το ταμείο — ώστε το "Allow?" (αν χρειαστεί)
// να εμφανιστεί ΤΩΡΑ, με τον ταμία μπροστά στην οθόνη, όχι στη μέση μιας πραγματικής πώλησης με
// πελάτη να περιμένει. Καλείται σιωπηλά (fire-and-forget) — ποτέ δεν μπλοκάρει τίποτα.
export async function warmUpPrinterConnection({ settings }) {
  if (!settings?.receiptPrinter?.enabled) return;
  try {
    const qz = await loadQz();
    await ensureConnected(qz, settings);
  } catch { /* η πραγματική πώληση θα δείξει το σφάλμα αν χρειαστεί */ }
}

// Εκτύπωση απόδειξης πραγματικής πώλησης. Δεν πετάει ποτέ σφάλμα — επιστρέφει πάντα
// { ok, error } ώστε ένα πρόβλημα εκτυπωτή να ΜΗΝ μπλοκάρει ποτέ την ίδια την πώληση.
export async function printReceipt({ invoice, settings }) {
  if (!settings?.receiptPrinter?.enabled) return { ok: false, error: "disabled" };
  try {
    const html = buildReceiptHtml({ invoice, settings });
    // Άνοιξε το συρτάρι μόνο σε μετρητά — σύμβαση των ταμείων, δεν χρειάζεται σε κάρτα/τράπεζα.
    const extraJobs = settings.receiptPrinter?.openCashDrawer && invoice.paymentMethod === "cash"
      ? [{ type: "raw", flavor: "hex", data: OPEN_DRAWER_HEX }]
      : [];
    return await sendToPrinter(html, settings, extraJobs);
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Εκτύπωση Ζ αναφοράς στον θερμικό εκτυπωτή — ζητήθηκε ρητά από το κουμπί στη σελίδα Ζ
// αναφοράς, άρα εκτυπώνει όσο υπάρχει ρυθμισμένο όνομα εκτυπωτή, ακόμα κι αν η αυτόματη
// εκτύπωση αποδείξεων (enabled) είναι σβηστή — αυτό αφορά μόνο την αυτόματη εκτύπωση ανά πώληση.
export async function printZReport({ report, mode, settings }) {
  if (!settings?.receiptPrinter?.name) return { ok: false, error: "no-printer-configured" };
  try {
    const html = buildZReportHtml({ report, mode, settings });
    return await sendToPrinter(html, settings);
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Λίστα των εκτυπωτών που "βλέπει" το ίδιο το QZ Tray — πιο αξιόπιστο από το να συγκρίνει
// κανείς το όνομα με το χέρι (αόρατοι χαρακτήρες, κενά, κ.λπ.). Επιστρέφει πάντα { ok, list|error }.
export async function listPrinters({ settings }) {
  const qz = await loadQz();
  try {
    await ensureConnected(qz, settings);
    const list = await qz.printers.find();
    return { ok: true, list: Array.isArray(list) ? list : [list] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Δοκιμαστική εκτύπωση από τις Ρυθμίσεις — για επιβεβαίωση σύνδεσης QZ Tray + εκτυπωτή,
// χωρίς να χρειάζεται πραγματική πώληση.
export async function testPrint({ settings }) {
  const fakeInvoice = {
    number: "TEST-00000",
    createdAt: new Date().toISOString(),
    items: [{ description: "Test item", quantity: 1, unit: "pcs", unitPrice: 10, vatRate: settings.vatRate ?? 19, discount: 0 }],
    net: 10, vat: (settings.vatRate ?? 19) / 10, total: 10 + (settings.vatRate ?? 19) / 10,
    paymentMethod: "cash",
  };
  try {
    const html = buildReceiptHtml({ invoice: fakeInvoice, settings });
    return await sendToPrinter(html, settings);
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Δοκιμαστικό άνοιγμα συρταριού από τις Ρυθμίσεις — χωρίς να χρειάζεται να τυπωθεί απόδειξη.
export async function testOpenDrawer({ settings }) {
  const printerName = settings.receiptPrinter?.name;
  if (!printerName) return { ok: false, error: "no-printer-configured" };
  const qz = await loadQz();
  try {
    await ensureConnected(qz, settings);
    const config = qz.configs.create(printerName);
    await qz.print(config, [{ type: "raw", flavor: "hex", data: OPEN_DRAWER_HEX }]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
