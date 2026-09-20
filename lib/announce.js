import { serverT } from "@/lib/i18n/server";
import { ruleLabel, ruleParts } from "@/lib/discountRules";

// Ανακοινώσεις προς πελάτες (email + ειδοποίηση στη σελίδα B2B τους).
//
// Το κείμενο που γράφει ο ιδιοκτήτης μπορεί να έχει "μεταβλητές" που συμπληρώνονται ΞΕΧΩΡΙΣΤΑ
// για κάθε πελάτη πριν σταλεί:
//   {name}       το όνομα του πελάτη
//   {company}    το όνομα της επιχείρησής σου
//   {link}       ο προσωπικός σύνδεσμος παραγγελιών του πελάτη (αν έχει B2B link)
//   {discounts}  οι ΠΡΑΓΜΑΤΙΚΕΣ εκπτώσεις που ισχύουν για αυτόν τον πελάτη, από την καρτέλα του
export const KNOWN_PLACEHOLDERS = ["name", "company", "link", "discounts"];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Βάση URL για τους συνδέσμους: ρύθμιση publicUrl αν υπάρχει, αλλιώς από το αίτημα (ο nginx περνάει
// σωστά Host και X-Forwarded-Proto).
export function originFrom(request, settings) {
  if (settings?.publicUrl) return String(settings.publicUrl).replace(/\/+$/, "");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  return host ? `${proto}://${host}` : "";
}

export function portalLinkFor(customer, origin) {
  return customer?.b2bEnabled && customer?.b2bToken && origin ? `${origin}/portal/${customer.b2bToken}` : "";
}

// Οι εκπτώσεις του πελάτη ως λίστα γραμμών — ό,τι έχει οριστεί στην καρτέλα του.
export function discountLines(customer, lang) {
  const t = (k, v) => serverT(lang, k, v);
  const lines = [];
  if (Number(customer.defaultDiscount) > 0) lines.push(t("announce.discGeneral", { percent: Number(customer.defaultDiscount) }));
  for (const r of customer.discountRules || []) {
    lines.push(t("announce.discRule", { name: ruleLabel(r), percent: ruleParts(r).percent }));
  }
  const n = (customer.customPrices || []).length;
  if (n > 0) lines.push(t("announce.discCustom", { count: n }));
  return lines;
}

export function hasAnyDiscount(customer) {
  return Number(customer.defaultDiscount) > 0 || (customer.discountRules || []).length > 0 || (customer.customPrices || []).length > 0;
}

// Μεταβλητές που δεν υπάρχουν στη λίστα (π.χ. τυπογραφικό {nmae}) — ο χρήστης προειδοποιείται πριν στείλει.
export function findUnknownPlaceholders(text) {
  const found = new Set();
  for (const m of String(text || "").matchAll(/\{(\w+)\}/g)) {
    if (!KNOWN_PLACEHOLDERS.includes(m[1].toLowerCase())) found.add(m[0]);
  }
  return [...found];
}

export function resolveText(text, { customer, company, link, lang }) {
  const filled = String(text || "").replace(/\{(\w+)\}/g, (whole, key) => {
    switch (key.toLowerCase()) {
      case "name": return customer?.name || "";
      case "company": return company || "";
      case "link": return link || "";
      case "discounts": return discountLines(customer || {}, lang).map((l) => `• ${l}`).join("\n");
      default: return whole; // άγνωστη μεταβλητή: μένει όπως γράφτηκε
    }
  });
  // Μεταβλητή που βγήκε κενή (π.χ. {discounts} σε πελάτη χωρίς εκπτώσεις) δεν αφήνει τρύπα από κενές γραμμές.
  return filled.replace(/\n{3,}/g, "\n\n");
}

// Κείμενο → HTML: κενή γραμμή = νέα παράγραφος, αλλαγή γραμμής = <br>, και οι σύνδεσμοι γίνονται κλικαμπλ.
function textToHtml(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.55;">${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#31415e;">$1</a>')}</p>`)
    .join("");
}

// Παράγει θέμα + HTML + απλό κείμενο για ΕΝΑΝ πελάτη.
export function buildAnnouncementEmail({ subject, body, customer, settings, lang, origin, includeButton = true }) {
  const t = (k, v) => serverT(lang, k, v);
  const company = settings.companyName || "";
  const link = portalLinkFor(customer, origin);
  const ctx = { customer, company, link, lang };

  const finalSubject = resolveText(subject, ctx).replace(/\s+/g, " ").trim();
  const finalText = resolveText(body, ctx);
  const greeting = t("announce.emailGreeting", { name: customer?.name || "" });
  const companyLine = [settings.address, settings.city, settings.postalCode].filter(Boolean).join(", ");
  const contact = [settings.phone, settings.email].filter(Boolean).join(" · ");

  const button = includeButton && link
    ? `<p style="margin:22px 0 6px;"><a href="${esc(link)}" style="background:#31415e;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600;display:inline-block;">${esc(t("announce.openPortal"))}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1e2433;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e6eaf2;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#31415e;color:#ffffff;padding:20px 24px;">
        <div style="font-size:18px;font-weight:700;">${esc(company)}</div>
        ${companyLine ? `<div style="font-size:12px;color:#c7d0e0;margin-top:2px;">${esc(companyLine)}</div>` : ""}
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 14px;font-size:14px;">${esc(greeting)}</p>
        ${textToHtml(finalText)}
        ${button}
        <p style="margin:22px 0 0;font-size:14px;">${esc(t("email.regards"))}<br>${esc(company)}</p>
      </td></tr>
      <tr><td style="background:#f7f9fc;padding:14px 24px;font-size:11px;color:#7b8598;border-top:1px solid #eef1f5;">
        ${contact ? `<div>${esc(contact)}</div>` : ""}
        <div style="margin-top:4px;">${esc(t("announce.footer", { company }))}</div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const plain = [
    greeting, "", finalText,
    includeButton && link ? `\n${t("announce.openPortal")}: ${link}` : "",
    "", t("email.regards"), company, "", "—", t("announce.footer", { company }),
  ].join("\n");

  return { subject: finalSubject, html, text: plain };
}
