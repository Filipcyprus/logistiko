import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { jobForPartner } from "@/lib/jobs";
import { verifyPortalSession } from "@/lib/portalAuth";

// Προσθήκη μηνύματος από τον συνεργάτη τυπογραφείο.
export async function POST(request, { params }) {
  const body = await request.json();
  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const db = readDB();
  const partner = (db.partnerShops || []).find((p) => p.portalEnabled && p.portalToken === params.token);
  if (!partner) return NextResponse.json({ error: "errors.invalidLink" }, { status: 404 });

  const session = await verifyPortalSession(request, "partner", partner.id);
  if (!session) return NextResponse.json({ error: "errors.loginRequired" }, { status: 401 });

  const job = db.jobs.find((x) => x.id === params.jobId && x.partnerShopId === partner.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const message = {
    id: uid(),
    author: "partner",
    authorName: partner.name,
    text: body.text.trim(),
    createdAt: new Date().toISOString(),
  };
  job.messages = [...(job.messages || []), message];
  writeDB(db);
  return NextResponse.json(jobForPartner(job), { status: 201 });
}
