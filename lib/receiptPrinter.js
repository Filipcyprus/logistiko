"use client";

// Αυτόματη εκτύπωση απόδειξης σε θερμικό εκτυπωτή μέσω QZ Tray — ένα δωρεάν τοπικό
// πρόγραμμα-γέφυρα που πρέπει να τρέχει στον ΙΔΙΟ υπολογιστή με τον εκτυπωτή/browser.
// Χωρίς πιστοποιητικό υπογραφής (ανυπόγραφη σύνδεση): το QZ Tray θα ρωτήσει "Allow?" την
// πρώτη φορά — τσέκαρε "Remember this decision" εκεί για να μη ρωτάει ξανά.
// https://qz.io

let qzModulePromise = null;
function loadQz() {
  if (!qzModulePromise) qzModulePromise = import("qz-tray").then((m) => m.default || m);
  return qzModulePromise;
}

async function ensureConnected(qz) {
  if (qz.websocket.isActive()) return;
  await qz.websocket.connect();
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

async function sendToPrinter(html, settings) {
  const printerName = settings.receiptPrinter?.name;
  if (!printerName) return { ok: false, error: "no-printer-configured" };
  const widthMm = Number(settings.receiptPrinter?.widthMm) || 80;

  const qz = await loadQz();
  try {
    await ensureConnected(qz);
    const config = qz.configs.create(printerName, { units: "mm", size: { width: widthMm }, margins: 0, scaleContent: true });
    await qz.print(config, [{ type: "pixel", format: "html", flavor: "plain", data: html }]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    try { if (qz.websocket.isActive()) await qz.websocket.disconnect(); } catch { /* best effort */ }
  }
}

// Εκτύπωση απόδειξης πραγματικής πώλησης. Δεν πετάει ποτέ σφάλμα — επιστρέφει πάντα
// { ok, error } ώστε ένα πρόβλημα εκτυπωτή να ΜΗΝ μπλοκάρει ποτέ την ίδια την πώληση.
export async function printReceipt({ invoice, settings }) {
  if (!settings?.receiptPrinter?.enabled) return { ok: false, error: "disabled" };
  try {
    const html = buildReceiptHtml({ invoice, settings });
    return await sendToPrinter(html, settings);
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
