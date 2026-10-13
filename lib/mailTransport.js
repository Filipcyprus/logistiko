import dns from "dns";
import fs from "fs";
import nodemailer from "nodemailer";

// Το droplet δεν έχει IPv6 route, αλλά το Node δοκιμάζει πρώτα τη διεύθυνση AAAA του SMTP host
// και αποτυγχάνει με ENETUNREACH. Λύνουμε το host σε IPv4 εμείς και κρατάμε το αρχικό όνομα για το TLS.
async function smtpTransport(mail) {
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

function addressList(v) {
  if (!v) return "";
  const list = Array.isArray(v) ? v : [v];
  return list.map((x) => (typeof x === "string" ? x : x?.address || "")).filter(Boolean).join(",");
}

function displayName(from) {
  const m = typeof from === "string" ? from.match(/^\s*"?([^"<]*?)"?\s*</) : null;
  return m ? m[1].trim() : "";
}

// Resolve a nodemailer attachment ({content} | {path: file | data: URI}) to base64.
async function attachmentToBase64(a) {
  let buf;
  if (a.content != null) buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), a.encoding || "utf8");
  else if (typeof a.path === "string" && a.path.startsWith("data:")) {
    const comma = a.path.indexOf(",");
    const meta = a.path.slice(5, comma);
    const body = a.path.slice(comma + 1);
    buf = meta.includes(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
  } else if (a.path) buf = await fs.promises.readFile(a.path);
  else return null;
  return buf.toString("base64");
}

// Αποστολή μέσω HTTPS προς Google Apps Script που στέλνει από το δικό σου Gmail — το DigitalOcean
// μπλοκάρει τις SMTP θύρες, αλλά το 443 είναι ανοιχτό.
function relayTransport(mail) {
  return nodemailer.createTransport({
    name: "gmail-relay",
    version: "1",
    send(mailObj, callback) {
      (async () => {
        const d = mailObj.data;
        const attachments = [];
        for (const a of d.attachments || []) {
          const data = await attachmentToBase64(a);
          if (data) attachments.push({ name: a.filename || "attachment", type: a.contentType || "application/octet-stream", data });
        }
        const to = addressList(d.to);
        const res = await fetch(mail.relayUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          redirect: "follow",
          signal: AbortSignal.timeout(90000),
          body: JSON.stringify({
            secret: mail.relaySecret || "",
            to,
            subject: d.subject || "",
            html: d.html || "",
            text: d.text || "",
            replyTo: addressList(d.replyTo),
            fromName: displayName(d.from),
            attachments,
          }),
        });
        const raw = await res.text();
        let out;
        try { out = JSON.parse(raw); } catch {
          throw new Error("Gmail relay did not return JSON — check the Apps Script web app is deployed with access set to 'Anyone'.");
        }
        if (!out.ok) throw new Error(`Gmail relay refused: ${out.error || "unknown error"}`);
        return { accepted: to.split(","), rejected: [], messageId: `relay-${Date.now()}` };
      })().then((info) => callback(null, info), (err) => callback(err));
    },
  });
}

export async function createMailTransport(mail) {
  return mail.relayUrl ? relayTransport(mail) : smtpTransport(mail);
}
