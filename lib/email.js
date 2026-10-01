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

  const subjectKey = { invoice: "email.subjectInvoice", receipt: "email.subjectReceipt", credit: "email.subjectCredit", quote: "email.subjectQuote", order: "email.subjectOrder", purchase: "email.subjectPurchase" }[kind] || "email.subjectInvoice";
  const bodyKey = { invoice: "email.bodyInvoice", receipt: "email.bodyReceipt", credit: "email.bodyCredit", quote: "email.bodyQuote", order: "email.bodyOrder", purchase: "email.bodyPurchase" }[kind] || "email.bodyInvoice";
  const docLabel = { invoice: doc.type === "timologio" ? t("invoices.docInvoice") : t("invoices.docReceipt"), receipt: t("invoices.docReceipt"), credit: t("invoices.docCredit"), quote: t("documents.quoteLabel"), order: t("documents.orderLabel"), purchase: t("purchases.poTitle") }[kind];

  const subject = t(subjectKey, { number: doc.number, company });
  // Για παραγγελία αγοράς ο παραλήπτης είναι ο προμηθευτής, όχι πελάτης.
  const recipientName = kind === "purchase" ? (doc.supplier?.name || "") : (doc.customer?.name || "");
  const greeting = recipientName ? t("email.greeting", { name: recipientName }) : t("email.greetingGeneric");

  // Παραγγελίες αγοράς δεν έχουν τιμές — μόνο περιγραφή/ποσότητα, χωρίς στήλες τιμής/συνόλου.
  const isPurchase = kind === "purchase";
  const rows = (doc.items || []).map((it) => {
    if (isPurchase) {
      return `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;">${esc(it.description)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;">${esc(it.quantity)} ${esc(it.unit || "")}</td>
      </tr>`;
    }
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
            ${isPurchase ? "" : `<td style="padding:6px;text-align:right;border-bottom:2px solid #e2e8f0;">${esc(t("invoices.colPrice"))}</td>
            <td style="padding:6px;text-align:right;border-bottom:2px solid #e2e8f0;">${esc(t("documents.total"))}</td>`}
          </tr>
          ${rows}
        </table>
        ${isPurchase ? "" : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;font-size:13px;">
          <tr><td style="text-align:right;color:#64748b;padding:2px 6px;">${esc(t("documents.net"))}</td><td style="text-align:right;padding:2px 6px;width:120px;">${fmt(doc.net, cur, lang)}</td></tr>
          <tr><td style="text-align:right;color:#64748b;padding:2px 6px;">${esc(t("documents.vat"))}</td><td style="text-align:right;padding:2px 6px;">${fmt(doc.vat, cur, lang)}</td></tr>
          <tr><td style="text-align:right;font-weight:700;font-size:15px;padding:6px;border-top:1px solid #e2e8f0;">${esc(t("documents.total"))}</td><td style="text-align:right;font-weight:700;font-size:15px;padding:6px;border-top:1px solid #e2e8f0;">${fmt(doc.total, cur, lang)}</td></tr>
        </table>`}
        <p style="margin:22px 0 0;font-size:13px;color:#475569;">${esc(t("email.regards"))}<br><strong>${esc(company)}</strong></p>
      </td></tr>
      ${contact ? `<tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #eef1f5;font-size:12px;color:#94a3b8;text-align:center;">${esc(contact)}</td></tr>` : ""}
    </table>
  </td></tr></table>
  </body></html>`;

  return { subject, html };
}

// Email προς συνεργάτη τυπογραφείο όταν του ανατίθεται μια δουλειά — αυτόματα, όχι με κουμπί.
// Μόνο ό,τι επιτρέπεται να δει ο συνεργάτης (βλ. lib/jobs.js -> jobForPartner): καθόλου στοιχεία πελάτη.
export function buildJobAssignedEmail({ job, partner, settings, lang, portalUrl }) {
  const t = (k, v) => serverT(lang, k, v);
  const company = settings.companyName || "";

  const subject = t("email.subjectJobAssigned", { number: job.number, title: job.title });
  const greeting = t("email.greeting", { name: partner.name });

  const priorityKey = { low: "jobs.priorities.low", normal: "jobs.priorities.normal", high: "jobs.priorities.high", urgent: "jobs.priorities.urgent" }[job.priority] || "jobs.priorities.normal";

  const rows = (job.items || []).map((it) => `<tr>
    <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;">${esc(it.description)}</td>
    <td style="padding:8px 6px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;">${esc(it.quantity)} ${esc(it.unit || "")}</td>
  </tr>`).join("");

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
        <p style="margin:0 0 18px;font-size:14px;color:#475569;">${esc(t("email.bodyJobAssigned"))}</p>
        <div style="display:inline-block;background:#f4f6fa;border-radius:6px;padding:10px 14px;margin-bottom:12px;">
          <span style="font-size:13px;color:#64748b;">${esc(job.number)} </span>
          <span style="font-size:16px;font-weight:700;color:#31415e;">${esc(job.title)}</span>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:14px;">
          ${job.dueDate ? `<tr><td style="color:#64748b;padding:2px 10px 2px 0;">${esc(t("email.jobDueDate"))}:</td><td style="font-weight:600;">${esc(job.dueDate)}</td></tr>` : ""}
          <tr><td style="color:#64748b;padding:2px 10px 2px 0;">${esc(t("email.jobPriority"))}:</td><td style="font-weight:600;">${esc(t(priorityKey))}</td></tr>
        </table>
        ${(job.items || []).length > 0 ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <tr style="color:#94a3b8;text-transform:uppercase;font-size:11px;">
            <td style="padding:6px;text-align:left;border-bottom:2px solid #e2e8f0;">${esc(t("invoices.colDescription"))}</td>
            <td style="padding:6px;text-align:right;border-bottom:2px solid #e2e8f0;">${esc(t("invoices.colQty"))}</td>
          </tr>
          ${rows}
        </table>` : `<p style="font-size:13px;color:#94a3b8;">${esc(t("email.jobNoItems"))}</p>`}
        ${(job.designs || []).length > 0 ? `<div style="margin-top:16px;">
          <div style="font-size:11px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">${esc(t("partnerPortal.designs"))}</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;">
            ${job.designs.map((d) => `<li>${esc(d.name)}</li>`).join("")}
          </ul>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${esc(t("email.designsAttachedNote"))}</div>
        </div>` : ""}
        ${portalUrl ? `<p style="margin:22px 0 0;"><a href="${esc(portalUrl)}" style="display:inline-block;background:#31415e;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:6px;">${esc(t("email.viewInPortal"))}</a></p>` : ""}
        <p style="margin:22px 0 0;font-size:13px;color:#475569;">${esc(t("email.regards"))}<br><strong>${esc(company)}</strong></p>
      </td></tr>
      ${contact ? `<tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #eef1f5;font-size:12px;color:#94a3b8;text-align:center;">${esc(contact)}</td></tr>` : ""}
    </table>
  </td></tr></table>
  </body></html>`;

  return { subject, html };
}
