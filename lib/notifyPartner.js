import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { buildJobAssignedEmail } from "@/lib/email";
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

// Αυτόματο email στον συνεργάτη τυπογραφείο μόλις του ανατεθεί μια δουλειά — καμία ενέργεια
// του χρήστη (κουμπί) δεν χρειάζεται, σε αντίθεση με τα emails παραστατικών (βλ. api/email).
// Ποτέ δεν πρέπει να ρίξει το αίτημα δημιουργίας/ενημέρωσης δουλειάς αν αποτύχει η αποστολή —
// γι' αυτό ο καλών πάντα το τυλίγει (ή εδώ) σε try/catch και απλώς το καταγράφει.
export async function notifyPartnerJobAssigned(db, job, partner, origin) {
  try {
    const mail = db.settings.mail || {};
    if (!mail.host) return; // δεν έχει ρυθμιστεί αποστολή email ακόμα — σιωπηλή παράλειψη
    if (!partner?.email) return; // ο συνεργάτης δεν έχει καταχωρισμένο email — τίποτα να στείλουμε

    const portalUrl = partner.portalToken && origin ? `${origin}/partner-portal/${partner.portalToken}` : null;

    const { subject, html } = buildJobAssignedEmail({
      job: jobForPartner(job),
      partner,
      settings: db.settings,
      lang: db.settings.language,
      portalUrl,
    });

    const transporter = nodemailer.createTransport({
      host: mail.host,
      port: Number(mail.port) || 587,
      secure: !!mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    });
    const from = mail.fromEmail
      ? `"${mail.fromName || db.settings.companyName}" <${mail.fromEmail}>`
      : (mail.user || undefined);
    const attachments = buildAttachments(job.designs);
    await transporter.sendMail({ from, to: partner.email, subject, html, attachments });
  } catch (e) {
    console.error("Partner job-assigned email failed:", e?.message || e);
  }
}
