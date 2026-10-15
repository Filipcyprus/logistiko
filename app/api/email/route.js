import { NextResponse } from "next/server";
import { createMailTransport } from "@/lib/mailTransport";
import { readDB } from "@/lib/db";
import { isMailConfigured } from "@/lib/mailConfig";
import { buildEmail } from "@/lib/email";
import { logActivity } from "@/lib/audit";

export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const mail = db.settings.mail || {};

  if (!isMailConfigured(mail)) return NextResponse.json({ error: "errors.emailNotConfigured" }, { status: 400 });

  const kind = body.kind; // invoice | credit | quote | order | purchase
  const coll = kind === "tender" ? db.tenders : kind === "order" ? db.orders : kind === "purchase" ? db.purchases : db.invoices;
  const doc = (coll || []).find((x) => x.id === body.id);
  if (!doc) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  // Παραλήπτης: από το body, αλλιώς το email του πελάτη (ή του προμηθευτή, για παραγγελία αγοράς).
  let to = (body.to || "").trim();
  if (!to && kind === "purchase") {
    to = (doc.supplier?.email || "").trim();
  } else if (!to && doc.customerId) {
    to = (db.customers.find((c) => c.id === doc.customerId)?.email || "").trim();
  }
  if (!to) return NextResponse.json({ error: "errors.noRecipient" }, { status: 400 });

  const emailKind = kind === "credit" || doc.type === "credit" ? "credit" : kind;
  const { subject, html } = buildEmail({ kind: emailKind, doc, settings: db.settings, lang: db.settings.language });

  try {
    const transporter = await createMailTransport(mail);
    const from = mail.fromEmail
      ? `"${mail.fromName || db.settings.companyName}" <${mail.fromEmail}>`
      : (mail.user || undefined);
    await transporter.sendMail({ from, to, subject, html });
  } catch (e) {
    console.error("Email error:", e?.message || e);
    await logActivity(request, "email_failed", { kind: emailKind, number: doc.number || "", to, subject, error: String(e?.message || e) });
    return NextResponse.json({ error: "errors.emailFailed" }, { status: 500 });
  }
  await logActivity(request, "email_sent", { kind: emailKind, number: doc.number || "", to, subject });

  return NextResponse.json({ ok: true });
}
