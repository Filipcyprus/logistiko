import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { readDB, writeDB, uid } from "@/lib/db";
import { buildAnnouncementEmail, originFrom } from "@/lib/announce";

export const dynamic = "force-dynamic";

// Πόσοι παραλήπτες μπαίνουν σε ΜΙΑ αποστολή: τα email στέλνονται ένα-ένα (κάθε πελάτης έχει τον δικό του
// προσωπικό σύνδεσμο), και ο nginx κόβει αιτήματα που κρατούν πάνω από ~60 δευτερόλεπτα.
const MAX_RECIPIENTS = 40;

export async function GET() {
  const list = (readDB().announcements || []).slice(0, 100).map((a) => ({
    id: a.id, createdAt: a.createdAt, subject: a.subject, kind: a.kind, channels: a.channels,
    audience: (a.audience || []).length, sent: a.sent || 0, failed: a.failed || 0, skipped: a.skipped || 0, results: a.results || [],
  }));
  return NextResponse.json(list);
}

// Τρεις τρόποι, ίδια επικύρωση:
//   preview:true  → επιστρέφει πώς θα φανεί το email σε έναν πελάτη (δεν στέλνει τίποτα)
//   testTo:"..."  → στέλνει ΜΟΝΟ ένα δοκιμαστικό στη διεύθυνση που δίνεις (δεν καταγράφεται, δεν πάει σε πελάτη)
//   αλλιώς        → πραγματική αποστολή στους επιλεγμένους πελάτες
export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const mail = db.settings.mail || {};
  const lang = db.settings.language;

  const subject = String(body.subject || "").trim();
  const text = String(body.body || "").trim();
  if (!subject) return NextResponse.json({ error: "announce.errNeedSubject" }, { status: 400 });
  if (subject.length > 200) return NextResponse.json({ error: "announce.errSubjectLong" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "announce.errNeedBody" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "announce.errBodyLong" }, { status: 400 });

  const ids = Array.isArray(body.customerIds) ? [...new Set(body.customerIds)] : [];
  const customers = ids.map((id) => db.customers.find((c) => c.id === id)).filter(Boolean);
  if (customers.length === 0) return NextResponse.json({ error: "announce.errNoRecipients" }, { status: 400 });

  const origin = originFrom(request, db.settings);
  const includeButton = body.includeLink !== false;
  const build = (c) => buildAnnouncementEmail({ subject, body: text, customer: c, settings: db.settings, lang, origin, includeButton });

  // ---- προεπισκόπηση
  if (body.preview) {
    const built = build(customers[0]);
    return NextResponse.json({ subject: built.subject, html: built.html, forCustomer: customers[0].name });
  }

  const transporterFor = () => nodemailer.createTransport({
    host: mail.host,
    port: Number(mail.port) || 587,
    secure: !!mail.secure,
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
  });
  const from = mail.fromEmail ? `"${mail.fromName || db.settings.companyName}" <${mail.fromEmail}>` : (mail.user || undefined);
  const replyTo = db.settings.email || undefined;

  // ---- δοκιμαστικό σε δική σου διεύθυνση
  if (body.testTo) {
    const to = String(body.testTo).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "announce.errBadTestAddress" }, { status: 400 });
    if (!mail.host) return NextResponse.json({ error: "errors.emailNotConfigured" }, { status: 400 });
    const built = build(customers[0]);
    try {
      await transporterFor().sendMail({ from, to, replyTo, subject: `[TEST] ${built.subject}`, html: built.html, text: built.text });
    } catch (e) {
      console.error("Announcement test email error:", e?.message || e);
      return NextResponse.json({ error: "errors.emailFailed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ---- πραγματική αποστολή
  const sendEmail = !!body.sendEmail;
  const showInPortal = !!body.showInPortal;
  if (!sendEmail && !showInPortal) return NextResponse.json({ error: "announce.errNoChannel" }, { status: 400 });
  if (sendEmail && !mail.host) return NextResponse.json({ error: "errors.emailNotConfigured" }, { status: 400 });
  if (customers.length > MAX_RECIPIENTS) return NextResponse.json({ error: "announce.errTooMany" }, { status: 400 });

  const transporter = sendEmail ? transporterFor() : null;
  const results = [];
  for (const c of customers) {
    const r = { customerId: c.id, name: c.name, email: String(c.email || "").trim(), status: "portalOnly" };
    if (sendEmail) {
      // Όποιος έχει ζητήσει να μη λαμβάνει ανακοινώσεις, δεν λαμβάνει — ακόμα κι αν επιλέχθηκε.
      if (c.emailOptOut) r.status = "optedOut";
      else if (!r.email) r.status = "noEmail";
      else {
        const built = build(c);
        try {
          await transporter.sendMail({ from, to: r.email, replyTo, subject: built.subject, html: built.html, text: built.text });
          r.status = "sent";
        } catch (e) {
          console.error("Announcement email error:", e?.message || e);
          r.status = "failed";
          r.error = String(e?.message || e).slice(0, 200);
        }
      }
    }
    results.push(r);
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  const rec = {
    id: uid(),
    createdAt: new Date().toISOString(),
    subject,
    body: text,
    kind: body.kind || "info",
    channels: { email: sendEmail, portal: showInPortal },
    includeLink: includeButton,
    audience: customers.map((c) => c.id),
    results,
    sent: count("sent"),
    failed: count("failed"),
    skipped: count("noEmail") + count("optedOut"),
  };

  // Η βάση ξαναδιαβάζεται ΤΩΡΑ: όσο στέλνονταν τα email, άλλα αιτήματα (πωλήσεις) μπορεί να έγραψαν —
  // γράφοντας το παλιό αντίγραφο θα χάνονταν.
  const fresh = readDB();
  fresh.announcements = [rec, ...(fresh.announcements || [])].slice(0, 500);
  writeDB(fresh);

  return NextResponse.json({ id: rec.id, sent: rec.sent, failed: rec.failed, skipped: rec.skipped, results });
}
