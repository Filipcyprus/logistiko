import { serverT } from "@/lib/i18n/server";
import { computeTotals } from "@/lib/format";

const LOCALE = { en: "en-US", el: "el-GR" };

function fmt(value, currency, lang) {
  const n = Number(value || 0);
  return n.toLocaleString(LOCALE[lang] || "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Παράγει θέμα + HTML σώμα email για παραστατικό/προσφορά/παραγγελία.
export function buildEmail({ kind, doc, settings, lang }) {
  const t = (k, v) => serverT(lang, k, v);
  const cur = settings.currency || "€";
  const company = settings.companyName || "";
  const isCredit = kind === "credit";
  const sign = isCredit ? -1 : 1;

  const subjectKey = { invoice: "email.subjectInvoice", credit: "email.subjectCredit", quote: "email.subjectQuote", order: "email.subjectOrder" }[kind] || "email.subjectInvoice";
  const bodyKey = { invoice: "email.bodyInvoice", credit: "email.bodyCredit", quote: "email.bodyQuote", order: "email.bodyOrder" }[kind] || "email.bodyInvoice";
  const docLabel = { invoice: doc.type === "timologio" ? t("invoices.docInvoice") : t("invoices.docReceipt"), credit: t("invoices.docCredit"), quote: t("documents.quoteLabel"), order: t("documents.orderLabel") }[kind];

  const subject = t(subjectKey, { number: doc.number, company });
  const custName = doc.customer?.name || "";
  const greeting = custName ? t("email.greeting", { name: custName }) : t("email.greetingGeneric");

  const rows = (doc.items || []).map((it) => {
    const lineTotal = sign * computeTotals([it]).total;
    return `<tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;">${esc(it.description)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;">${esc(it.quantity)} ${esc(it.unit || "")}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;">${fmt(it.unitPrice, cur, lang)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;">${fmt(lineTotal, cur, lang)}</td>
    </tr>`;
  }).join("");

  const companyLine = [settings.address, settings.city, settings.postalCode].filter(Boolean).join(", ");
  const contact = [settings.phone, settings.email].filter(Boolean).join(" · ");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1e2433;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e6eaf2;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#31415e;color:#ffffff;padding:20px 24px;">
        <div style="font-size:18px;font-weight:700;">${esc(company)}</div>
        ${companyLine ? `<div style="font-size:12px;color:#c7d0e0;margin-top:2px;">${esc(companyLine)}</div>` : ""}
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 6px;font-size:14px;">${esc(greeting)}</p>
        <p style="margin:0 0 18px;font-size:14px;color:#475569;">${esc(t(bodyKey))}</p>
        <div style="display:inline-block;background:#f4f6fa;border-radius:6px;padding:10px 14px;margin-bottom:16px;">
          <span style="font-size:13px;color:#64748b;">${esc(docLabel)} </span>
          <span style="font-size:16px;font-weight:700;color:#31415e;">${esc(doc.number)}</span>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <tr style="color:#94a3b8;text-transform:uppercase;font-size:11px;">
            <td style="padding:6px;text-align:left;border-bottom:2px solid #e2e8f0;">${esc(t("invoices.colDescription"))}</td>
            <td style="padding:6px;text-align:right;border-bottom:2px solid #e2e8f0;">${esc(t("invoices.colQty"))}</td>
            <td style="padding:6px;text-align:right;border-bottom:2px solid #e2e8f0;">${esc(t("invoices.colPrice"))}</td>
            <td style="padding:6px;text-align:right;border-bottom:2px solid #e2e8f0;">${esc(t("documents.total"))}</td>
          </tr>
          ${rows}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;font-size:13px;">
          <tr><td style="text-align:right;color:#64748b;padding:2px 6px;">${esc(t("documents.net"))}</td><td style="text-align:right;padding:2px 6px;width:120px;">${fmt(doc.net, cur, lang)}</td></tr>
          <tr><td style="text-align:right;color:#64748b;padding:2px 6px;">${esc(t("documents.vat"))}</td><td style="text-align:right;padding:2px 6px;">${fmt(doc.vat, cur, lang)}</td></tr>
          <tr><td style="text-align:right;font-weight:700;font-size:15px;padding:6px;border-top:1px solid #e2e8f0;">${esc(t("documents.total"))}</td><td style="text-align:right;font-weight:700;font-size:15px;padding:6px;border-top:1px solid #e2e8f0;">${fmt(doc.total, cur, lang)}</td></tr>
        </table>
        <p style="margin:22px 0 0;font-size:13px;color:#475569;">${esc(t("email.regards"))}<br><strong>${esc(company)}</strong></p>
      </td></tr>
      ${contact ? `<tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #eef1f5;font-size:12px;color:#94a3b8;text-align:center;">${esc(contact)}</td></tr>` : ""}
    </table>
  </td></tr></table>
  </body></html>`;

  return { subject, html };
}
