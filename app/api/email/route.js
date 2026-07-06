import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { readDB } from "@/lib/db";
import { buildEmail } from "@/lib/email";

export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const mail = db.settings.mail || {};

  if (!mail.host) return NextResponse.json({ error: "errors.emailNotConfigured" }, { status: 400 });

  const kind = body.kind; // invoice | credit | quote | order
  const coll = kind === "quote" ? db.quotes : kind === "order" ? db.orders : db.invoices;
  const doc = (coll || []).find((x) => x.id === body.id);
  if (!doc) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  // Παραλήπτης: από το body, αλλιώς το email του πελάτη.
  let to = (body.to || "").trim();
  if (!to && doc.customerId) {
    to = (db.customers.find((c) => c.id === doc.customerId)?.email || "").trim();
  }
  if (!to) return NextResponse.json({ error: "errors.noRecipient" }, { status: 400 });

  const emailKind = kind === "credit" || doc.type === "credit" ? "credit" : kind;
  const { subject, html } = buildEmail({ kind: emailKind, doc, settings: db.settings, lang: db.settings.language });

  try {
    const transporter = nodemailer.createTransport({
      host: mail.host,
      port: Number(mail.port) || 587,
      secure: !!mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    });
    const from = mail.fromEmail
      ? `"${mail.fromName || db.settings.companyName}" <${mail.fromEmail}>`
      : (mail.user || undefined);
    await transporter.sendMail({ from, to, subject, html });
  } catch (e) {
    console.error("Email error:", e?.message || e);
    return NextResponse.json({ error: "errors.emailFailed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
