import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { sendPartnerJobEmail, recordPartnerEmailStatus } from "@/lib/notifyPartner";
import { originFrom } from "@/lib/announce";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Χειροκίνητη (ξανα)αποστολή του email της δουλειάς στον συνεργάτη — περιμένει το αποτέλεσμα ώστε
// ο χρήστης να δει αμέσως αν στάλθηκε ή γιατί απέτυχε.
export async function POST(request, { params }) {
  const db = readDB();
  const job = (db.jobs || []).find((j) => j.id === params.id);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  const partner = (db.partnerShops || []).find((p) => p.id === job.partnerShopId);
  if (!partner) return NextResponse.json({ ok: false, error: "Choose a partner shop for this job first." }, { status: 400 });

  const result = await sendPartnerJobEmail(db, job, partner, originFrom(request, db.settings));
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  recordPartnerEmailStatus(job.id, result, session);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
