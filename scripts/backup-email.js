// Στέλνει καθημερινό αντίγραφο ασφαλείας της data/db.json με email, εκτός server —
// έτσι υπάρχει αντίγραφο ακόμα κι αν χαθεί ολόκληρο το droplet. Τρέχει standalone
// μέσω cron (όχι μέσα στο Next.js app), με τις ίδιες ρυθμίσεις SMTP από τις Ρυθμίσεις.
//
// Χρήση: node scripts/backup-email.js
// Cron (καθημερινά 03:00): 0 3 * * * cd /var/www/logistiko && node scripts/backup-email.js >> /var/log/logistiko-backup.log 2>&1

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const nodemailer = require("nodemailer");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`Δεν βρέθηκε ${DB_FILE}`);
  }

  const raw = fs.readFileSync(DB_FILE);
  const db = JSON.parse(raw);
  const mail = db.settings?.mail || {};

  if (!mail.host) {
    throw new Error("Δεν έχει ρυθμιστεί SMTP (Ρυθμίσεις > Email) — δεν μπορεί να σταλεί backup.");
  }

  const to = (mail.backupEmail || mail.fromEmail || mail.user || "").trim();
  if (!to) {
    throw new Error("Δεν βρέθηκε email παραλήπτη για το backup (fromEmail/user στις ρυθμίσεις mail).");
  }

  const gzipped = zlib.gzipSync(raw);
  const today = new Date().toISOString().slice(0, 10);

  const transporter = nodemailer.createTransport({
    host: mail.host,
    port: Number(mail.port) || 587,
    secure: !!mail.secure,
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
  });

  const from = mail.fromEmail
    ? `"${mail.fromName || db.settings.companyName || "Logistiko Backup"}" <${mail.fromEmail}>`
    : mail.user;

  await transporter.sendMail({
    from,
    to,
    subject: `Logistiko backup ${today}`,
    text: `Αυτόματο καθημερινό αντίγραφο ασφαλείας της βάσης δεδομένων (${today}).`,
    attachments: [{ filename: `logistiko-db-${today}.json.gz`, content: gzipped }],
  });

  console.log(`[${new Date().toISOString()}] Backup email sent to ${to} (${gzipped.length} bytes gzipped)`);
}

main().catch((e) => {
  console.error(`[${new Date().toISOString()}] Backup FAILED:`, e.message);
  process.exit(1);
});
