import PDFDocument from "pdfkit";
import path from "path";
import { serverT } from "@/lib/i18n/server";
import { computeTotals } from "@/lib/format";

// DejaVu Sans: περιέχει ελληνικά, λατινικά και το σύμβολο €, ώστε τα PDF να τυπώνονται σωστά σε κάθε γλώσσα.
const FONT_DIR = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
const REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

const LOCALE = { en: "en-US", el: "el-GR" };
const INK = "#1e2433";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const BRAND = "#31415e";
const RED = "#dc2626";

function fmt(value, cur, lang) {
  const n = Number(value || 0);
  return n.toLocaleString(LOCALE[lang] || "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + cur;
}
const fmtDate = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

// Παράγει PDF (Buffer) για παραστατικό / πιστωτικό / προσφορά / παραγγελία / παραγγελία αγοράς.
export function buildDocumentPdf({ kind, doc, settings, lang }) {
  return new Promise((resolve, reject) => {
    const t = (k, v) => serverT(lang, k, v);
    const cur = settings.currency || "€";
    const isCredit = kind === "credit";
    const isPurchase = kind === "purchase";
    const sign = isCredit ? -1 : 1;

    const pdf = new PDFDocument({ size: "A4", margin: 40, font: REGULAR, info: { Title: doc.number, Author: settings.companyName || "" } });
    const chunks = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.registerFont("R", REGULAR);
    pdf.registerFont("B", BOLD);

    const L = 40;
    const W = pdf.page.width - 80; // 515
    const R = L + W;
    const BOTTOM = pdf.page.height - 56;

    const title = {
      invoice: doc.type === "timologio" ? t("invoices.docInvoice") : doc.isPaymentReceipt ? t("invoices.docPaymentReceipt") : t("invoices.docReceipt"),
      receipt: t("invoices.docReceipt"),
      credit: t("invoices.docCredit"),
      quote: t("documents.tenderLabel"),
      tender: t("documents.tenderLabel"),
      order: t("documents.orderLabel"),
      purchase: t("purchases.poTitle"),
    }[kind] || t("invoices.docReceipt");

    // ---------- header ----------
    let leftY = 40;
    try {
      if (settings.logo && String(settings.logo).startsWith("data:image")) {
        const buf = Buffer.from(String(settings.logo).split(",")[1], "base64");
        pdf.image(buf, L, 40, { fit: [120, 44] });
        leftY = 90;
      }
    } catch { /* λογότυπο που δεν διαβάζεται: συνεχίζουμε χωρίς αυτό */ }

    pdf.font("B").fontSize(13).fillColor(INK).text(settings.companyName || "", L, leftY, { width: 270 });
    pdf.font("R").fontSize(8.5).fillColor(MUTED);
    const addr = [settings.address, [settings.city, settings.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (addr) pdf.text(addr, L, pdf.y + 1, { width: 270 });
    if (settings.afm) pdf.text(`${t("customers.fieldTaxId")}: ${settings.afm}`, L, pdf.y + 1, { width: 270 });
    if (settings.phone) pdf.text(`${t("customers.fieldPhone")}: ${settings.phone}`, L, pdf.y + 1, { width: 270 });
    if (settings.email) pdf.text(settings.email, L, pdf.y + 1, { width: 270 });
    const leftEnd = pdf.y;

    let ry = 40;
    const rightText = (str, font, size, color, gap = 2) => {
      pdf.font(font).fontSize(size).fillColor(color).text(str, R - 230, ry, { width: 230, align: "right" });
      ry = pdf.y + gap;
    };
    rightText(title, "B", 12, isCredit ? RED : INK);
    rightText(doc.number || "", "B", 19, BRAND, 3);
    if (doc.relatedNumber) rightText(t("invoices.relatedInvoice", { number: doc.relatedNumber }), "R", 8.5, MUTED);
    rightText(t("invoices.dateLabel", { date: fmtDate(doc.date) }), "R", 9.5, MUTED);
    if (doc.series && doc.aa) rightText(t("invoices.seriesAA", { series: doc.series, aa: doc.aa }), "R", 8, MUTED);
    if (!isCredit && !isPurchase && (kind === "invoice" || kind === "receipt")) {
      rightText(doc.status === "paid" ? t("invoices.statusPaid") : t("invoices.statusUnpaid"), "B", 9, doc.status === "paid" ? "#047857" : "#b45309");
    }

    let y = Math.max(leftEnd, ry) + 12;
    pdf.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.7).stroke();
    y += 10;

    // ---------- customer / supplier ----------
    const party = isPurchase ? doc.supplier : doc.customer;
    pdf.font("B").fontSize(7.5).fillColor(MUTED).text((isPurchase ? t("purchases.colSupplier") : t("invoices.customerDetails")).toUpperCase(), L, y);
    y = pdf.y + 2;
    if (party && party.name) {
      pdf.font("B").fontSize(10).fillColor(INK).text(party.name, L, y, { width: 330 });
      pdf.font("R").fontSize(8.5).fillColor(MUTED);
      if (party.profession) pdf.text(party.profession, L, pdf.y + 1, { width: 330 });
      const pAddr = [party.address, party.city].filter(Boolean).join(", ");
      if (pAddr) pdf.text(pAddr, L, pdf.y + 1, { width: 330 });
      if (party.afm) pdf.text(`${t("customers.fieldTaxId")}: ${party.afm}`, L, pdf.y + 1, { width: 330 });
      if (party.phone) pdf.text(`${t("customers.fieldPhone")}: ${party.phone}`, L, pdf.y + 1, { width: 330 });
      if (party.email) pdf.text(party.email, L, pdf.y + 1, { width: 330 });
    } else {
      pdf.font("R").fontSize(9.5).fillColor(INK).text(t("invoices.retailSale"), L, y);
    }
    y = pdf.y + 16;

    // ---------- items table ----------
    const cols = isPurchase
      ? [{ k: "desc", w: W - 120, a: "left" }, { k: "qty", w: 120, a: "right" }]
      : [{ k: "desc", w: 208, a: "left" }, { k: "qty", w: 70, a: "right" }, { k: "price", w: 70, a: "right" }, { k: "disc", w: 45, a: "right" }, { k: "vat", w: 42, a: "right" }, { k: "total", w: 80, a: "right" }];
    const labels = { desc: t("invoices.colDescription"), qty: t("invoices.colQty"), price: t("invoices.colPrice"), disc: t("invoices.colDiscount"), vat: t("common.vat"), total: t("documents.total") };

    const drawRow = (cells, { head = false, bold = false } = {}) => {
      const pad = 3;
      pdf.font(head || bold ? "B" : "R").fontSize(head ? 7.5 : 9);
      const heights = cols.map((c) => pdf.heightOfString(String(cells[c.k] ?? ""), { width: c.w - pad * 2 }));
      const h = Math.max(...heights) + 8;
      if (y + h > BOTTOM) { pdf.addPage(); y = 40; drawRow(Object.fromEntries(cols.map((c) => [c.k, labels[c.k]])), { head: true }); }
      let x = L;
      pdf.font(head || bold ? "B" : "R").fontSize(head ? 7.5 : 9).fillColor(head ? MUTED : INK);
      cols.forEach((c) => {
        pdf.text(head ? String(cells[c.k] ?? "").toUpperCase() : String(cells[c.k] ?? ""), x + pad, y + 4, { width: c.w - pad * 2, align: c.a });
        x += c.w;
      });
      y += h;
      pdf.moveTo(L, y).lineTo(R, y).strokeColor(head ? "#94a3b8" : "#e2e8f0").lineWidth(head ? 1 : 0.5).stroke();
    };

    drawRow(Object.fromEntries(cols.map((c) => [c.k, labels[c.k]])), { head: true });
    for (const it of doc.items || []) {
      if (isPurchase) {
        drawRow({ desc: it.description, qty: `${it.quantity} ${it.unit || ""}`.trim() });
      } else {
        drawRow({
          desc: it.description,
          qty: `${it.quantity} ${it.unit || ""}`.trim(),
          price: fmt(it.unitPrice, cur, lang),
          disc: it.discount ? `${it.discount}%` : "—",
          vat: `${Number(it.vatRate || 0)}%`,
          total: fmt(sign * computeTotals([it]).total, cur, lang),
        });
      }
    }

    // ---------- totals ----------
    if (!isPurchase) {
      const grossNet = (doc.items || []).reduce((a, it) => a + Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount || 0) / 100), 0);
      const factor = grossNet > 0 ? 1 - Number(doc.invoiceDiscount || 0) / grossNet : 1;
      const groups = {};
      for (const it of doc.items || []) {
        const r = Number(it.vatRate || 0);
        groups[r] = (groups[r] || 0) + sign * Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount || 0) / 100) * factor;
      }
      const rows = [];
      Object.entries(groups).forEach(([r, net]) => rows.push([t("invoices.netVatRate", { rate: r }), fmt(net, cur, lang), "R", MUTED]));
      if (Number(doc.invoiceDiscount) > 0 && !isCredit) {
        rows.push([t("invoices.subtotalBeforeDiscount"), fmt(doc.subtotal ?? 0, cur, lang), "R", INK]);
        rows.push([t("invoices.discountLabel"), "− " + fmt(doc.invoiceDiscount, cur, lang), "R", "#047857"]);
      }
      rows.push([t("invoices.netTotal"), fmt(doc.net, cur, lang), "R", INK]);
      rows.push([t("invoices.vatTotal"), fmt(doc.vat, cur, lang), "R", INK]);

      const need = rows.length * 15 + 60;
      if (y + need > BOTTOM) { pdf.addPage(); y = 40; }
      y += 12;
      const bx = R - 250;
      for (const [label, val, f, color] of rows) {
        pdf.font(f).fontSize(9).fillColor(color).text(label, bx, y, { width: 150 });
        pdf.font(f).fontSize(9).fillColor(INK).text(val, bx + 150, y, { width: 100, align: "right" });
        y += 15;
      }
      pdf.moveTo(bx, y + 1).lineTo(R, y + 1).strokeColor("#94a3b8").lineWidth(0.8).stroke();
      y += 6;
      pdf.font("B").fontSize(12).fillColor(isCredit ? RED : INK).text(t("invoices.payable"), bx, y, { width: 130 });
      pdf.font("B").fontSize(12).fillColor(isCredit ? RED : INK).text(fmt(doc.total, cur, lang), bx + 120, y, { width: 130, align: "right" });
      y += 20;
      if (kind !== "credit" && doc.status === "unpaid" && (kind === "invoice" || kind === "receipt")) {
        const balance = Math.round((Number(doc.total) - Number(doc.paidAmount || 0)) * 100) / 100;
        pdf.font("R").fontSize(9).fillColor("#047857").text(t("invoices.paidAmount"), bx, y, { width: 150 });
        pdf.text(fmt(doc.paidAmount || 0, cur, lang), bx + 150, y, { width: 100, align: "right" });
        y += 15;
        pdf.font("B").fontSize(10).fillColor("#b45309").text(t("invoices.balance"), bx, y, { width: 150 });
        pdf.text(fmt(balance, cur, lang), bx + 150, y, { width: 100, align: "right" });
        y += 18;
      }
    }

    // ---------- payment, bank, notes, footer ----------
    const ensure = (h) => { if (y + h > BOTTOM) { pdf.addPage(); y = 40; } };
    if (doc.paymentMethod && (kind === "invoice" || kind === "receipt" || kind === "credit")) {
      ensure(24);
      y += 8;
      const nameOf = (m) => { const n = t(`common.paymentMethods.${m}`); return n.startsWith("common.") ? m : n; };
      const methodText = Array.isArray(doc.paymentSplit) && doc.paymentSplit.length > 1
        ? doc.paymentSplit.map((s) => `${nameOf(s.method)} ${fmt(s.amount)}`).join(" + ")
        : nameOf(doc.paymentMethod);
      pdf.font("R").fontSize(9).fillColor(MUTED).text(t("invoices.paymentMethodLine", { method: methodText }), L, y, { width: W });
      y = pdf.y + 4;
    }
    if (settings.bankIban && !isCredit && doc.status === "unpaid" && (kind === "invoice" || kind === "receipt")) {
      ensure(80);
      y += 6;
      const lines = [settings.bankName, settings.bankAccountHolder ? `${t("invoices.bankAccountHolder")}: ${settings.bankAccountHolder}` : "", `IBAN: ${settings.bankIban}`, settings.bankSwift ? `SWIFT/BIC: ${settings.bankSwift}` : ""].filter(Boolean);
      const boxH = 22 + lines.length * 12;
      pdf.roundedRect(L, y, W, boxH, 4).fillColor("#f8fafc").fill();
      pdf.font("B").fontSize(7.5).fillColor(MUTED).text(t("invoices.bankDetailsTitle").toUpperCase(), L + 10, y + 8);
      let by = y + 21;
      pdf.font("R").fontSize(9).fillColor(INK);
      for (const ln of lines) { pdf.text(ln, L + 10, by, { width: W - 20 }); by += 12; }
      y += boxH + 4;
    }
    if (doc.notes) {
      ensure(30);
      y += 6;
      pdf.font("B").fontSize(9).fillColor(INK).text(t("documents.notes") + ":", L, y, { continued: true });
      pdf.font("R").text(" " + String(doc.notes), { width: W });
      y = pdf.y + 4;
    }
    if (doc.shopName) {
      ensure(30);
      y += 10;
      pdf.font("B").fontSize(8).fillColor(MUTED).text(String(doc.shopName).toUpperCase(), L, y, { width: W, align: "center" });
      y = pdf.y + 4;
    }
    if (settings.footerNote) {
      ensure(30);
      y += 8;
      pdf.font("R").fontSize(9).fillColor(MUTED).text(settings.footerNote, L, y, { width: W, align: "center" });
    }

    pdf.end();
  });
}
