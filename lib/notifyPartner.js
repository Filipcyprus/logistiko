import fs from "fs";
import { readDB, writeDB } from "@/lib/db";
import { pushActivity } from "@/lib/audit";
import path from "path";
import { createMailTransport } from "@/lib/mailTransport";
import { isMailConfigured } from "@/lib/mailConfig";
import { buildJobAssignedEmail, buildInvoiceRequestEmail } from "@/lib/email";
import { jobForPartner } from "@/lib/jobs";
import { UPLOAD_DIR } from "@/lib/uploads";

// Τα περισσότερα SMTP (π.χ. Gmail) απορρίπτουν email πάνω από ~25MB συνολικά· αν τα σχέδια
// μιας δουλειάς ξεπερνούν αυτό αφήνουμε μόνο τη λίστα ονομάτων στο σώμα του email (ο συνεργάτης
// τα κατεβάζει από το portal) αντί να αποτύχει ολόκληρη η αποστολή.
const MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

// Μετατρέπει τα σχέδια μιας δουλειάς σε πραγματικά συνημμένα email, διαβάζοντας τα αρχεία
// από το δίσκο (βλ. lib/uploads.js). Παλιά σχέδια που έμειναν ως ενσωματωμένο base64 δουλεύουν
// επίσης — το nodemailer δέχεται data: URI απευθείας σε attachment.path.
function buildAttachments(designs) {
  const attachments = [];
  let total = 0;
  for (const d of designs || []) {
    let size = 0;
    let entry = null;
    if (d.url) {
      const filename = String(d.url).split("/").pop();
      const filePath = path.join(UPLOAD_DIR, filename);
      if (!fs.existsSync(filePath)) continue;
      size = fs.statSync(filePath).size;
      entry = { filename: d.name || filename, path: filePath };
    } else if (d.dataUrl) {
      size = Buffer.byteLength(d.dataUrl, "utf8");
      entry = { filename: d.name || "file", path: d.dataUrl };
    }
    if (!entry) continue;
    if (total + size > MAX_ATTACHMENTS_BYTES) continue; // παράλειψη των υπόλοιπων αντί αποτυχίας όλης της αποστολής
    total += size;
    attachments.push(entry);
  }
  return attachments;
}

// Στέλνει στον συνεργάτη τυπογραφείο το email της δουλειάς (στοιχεία + σχέδια ως συνημμένα) και
// ΕΠΙΣΤΡΕΦΕΙ { ok, to?, error? } — ποτέ δεν ρίχνει εξαίρεση, ώστε η δημιουργία/ενημέρωση δουλειάς
// να μη χαλάει ποτέ από πρόβλημα email.
export async function sendPartnerJobEmail(db, job, partner, origin) {
  try {
    const mail = db.settings.mail || {};
    if (!isMailConfigured(mail)) return { ok: false, error: "Email is not set up yet (Settings → Email)." };
    if (!partner?.email) return { ok: false, error: "This partner shop has no email address." };

    const portalUrl = partner.portalToken && origin ? `${origin}/partner-portal/${partner.portalToken}` : null;

    const { subject, html } = buildJobAssignedEmail({
      job: jobForPartner(job),
      partner,
      settings: db.settings,
      lang: db.settings.language,
      portalUrl,
    });

    const transporter = await createMailTransport(mail);
    const from = mail.fromEmail
      ? `"${mail.fromName || db.settings.companyName}" <${mail.fromEmail}>`
      : (mail.user || undefined);
    const attachments = buildAttachments(job.designs);
    await transporter.sendMail({ from, to: partner.email, subject, html, attachments });
    return { ok: true, to: partner.email, subject };
  } catch (e) {
    console.error("Partner job email failed:", e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}

// Ζητά από τον συνεργάτη το τιμολόγιο μιας ολοκληρωμένης δουλειάς. Επιστρέφει { ok, to?, subject?, error? }.
export async function sendPartnerInvoiceRequest(db, job, partner, wanted = true) {
  try {
    const mail = db.settings.mail || {};
    if (!isMailConfigured(mail)) return { ok: false, error: "Email is not set up yet (Settings → Email)." };
    if (!partner?.email) return { ok: false, error: "This partner shop has no email address." };
    const { subject, html } = buildInvoiceRequestEmail({ job: jobForPartner(job), partner, settings: db.settings, lang: db.settings.language, wanted });
    const transporter = await createMailTransport(mail);
    const from = mail.fromEmail
      ? `"${mail.fromName || db.settings.companyName}" <${mail.fromEmail}>`
      : (mail.user || undefined);
    await transporter.sendMail({ from, to: partner.email, subject, html });
    return { ok: true, to: partner.email, subject };
  } catch (e) {
    console.error("Partner invoice request failed:", e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}

export function recordInvoiceRequest(jobId, result, session = null, wanted = true) {
  try {
    const db = readDB();
    const job = (db.jobs || []).find((j) => j.id === jobId);
    if (!job) return;
    job.invoiceRequest = { at: new Date().toISOString(), wanted, ok: !!result.ok, to: result.to || "", error: result.ok ? "" : String(result.error || "") };
    pushActivity(db, result.ok ? "email_sent" : "email_failed", {
      kind: wanted ? "invoiceRequest" : "noInvoice", number: job.number, to: result.to || "", subject: result.subject || "", error: result.ok ? "" : String(result.error || ""),
    }, session);
    writeDB(db);
  } catch (e) {
    console.error("Could not record invoice request:", e?.message || e);
  }
}

// Κρατά στη δουλειά αν το email στάλθηκε — ξαναδιαβάζει τη βάση (η αποστολή κράτησε λίγο και
// κάποιος μπορεί να έχει αλλάξει τη δουλειά στο μεταξύ) και αλλάζει ΜΟΝΟ αυτό το πεδίο.
export function recordPartnerEmailStatus(jobId, result, session = null) {
  try {
    const db = readDB();
    const job = (db.jobs || []).find((j) => j.id === jobId);
    if (!job) return;
    job.partnerEmail = { at: new Date().toISOString(), ok: !!result.ok, to: result.to || "", error: result.ok ? "" : String(result.error || "") };
    const partner = (db.partnerShops || []).find((p) => p.id === job.partnerShopId);
    pushActivity(db, result.ok ? "email_sent" : "email_failed", {
      kind: "job", number: job.number, to: result.to || partner?.email || "", subject: result.subject || "", error: result.ok ? "" : String(result.error || ""),
    }, session);
    writeDB(db);
  } catch (e) {
    console.error("Could not record partner email status:", e?.message || e);
  }
}

// Αυτόματη αποστολή μόλις η δουλειά ανατίθεται σε συνεργάτη (χωρίς να περιμένει ο χρήστης).
export async function notifyPartnerJobAssigned(db, job, partner, origin) {
  const result = await sendPartnerJobEmail(db, job, partner, origin);
  recordPartnerEmailStatus(job.id, result);
  return result;
}
