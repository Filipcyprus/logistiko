import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { sendPartnerInvoiceRequest, recordInvoiceRequest } from "@/lib/notifyPartner";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Ο ιδιοκτήτης ζητά από το συνεργάτη τυπογραφείο το τιμολόγιο μιας ολοκληρωμένης δουλειάς.
// Περιμένει το αποτέλεσμα ώστε να φανεί αμέσως αν στάλθηκε ή γιατί απέτυχε.
export async function POST(request, { params }) {
  const db = readDB();
  const job = (db.jobs || []).find((j) => j.id === params.id);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  const partner = (db.partnerShops || []).find((p) => p.id === job.partnerShopId);
  if (!partner) return NextResponse.json({ ok: false, error: "This job has no partner shop to invoice you." }, { status: 400 });

  const result = await sendPartnerInvoiceRequest(db, job, partner);
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  recordInvoiceRequest(job.id, result, session);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
