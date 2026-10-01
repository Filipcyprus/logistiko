import nodemailer from "nodemailer";
import { buildJobAssignedEmail } from "@/lib/email";
import { jobForPartner } from "@/lib/jobs";

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
    await transporter.sendMail({ from, to: partner.email, subject, html });
  } catch (e) {
    console.error("Partner job-assigned email failed:", e?.message || e);
  }
}
