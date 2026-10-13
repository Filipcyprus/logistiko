import dns from "dns";
import nodemailer from "nodemailer";

// Το droplet δεν έχει IPv6 route, αλλά το Node δοκιμάζει πρώτα τη διεύθυνση AAAA του SMTP host
// και αποτυγχάνει με ENETUNREACH. Λύνουμε το host σε IPv4 εμείς και κρατάμε το αρχικό όνομα για το TLS.
export async function createMailTransport(mail) {
  let host = mail.host;
  try {
    const { address } = await dns.promises.lookup(mail.host, { family: 4 });
    host = address;
  } catch {
    // αν αποτύχει η αναζήτηση IPv4 πέφτουμε πίσω στο όνομα όπως είναι
  }
  return nodemailer.createTransport({
    host,
    port: Number(mail.port) || 587,
    secure: !!mail.secure,
    tls: { servername: mail.host },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
  });
}
