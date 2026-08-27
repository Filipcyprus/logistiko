import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { verifyPortalSession } from "@/lib/portalAuth";
import { jobForPartner } from "@/lib/jobs";

// Δεδομένα partner portal — εργασίες ανατεθειμένες σε συγκεκριμένο συνεργάτη τυπογραφείο.
// Απαιτείται σύνδεση (login) με λογαριασμό partner που αντιστοιχεί ακριβώς σε αυτόν τον συνεργάτη.
export async function GET(request, { params }) {
  const db = readDB();
  const partner = (db.partnerShops || []).find((p) => p.portalEnabled && p.portalToken === params.token);
  if (!partner) return NextResponse.json({ error: "errors.invalidLink" }, { status: 404 });

  const session = await verifyPortalSession(request, "partner", partner.id);
  if (!session) return NextResponse.json({ error: "errors.loginRequired" }, { status: 401 });

  const jobs = (db.jobs || [])
    .filter((j) => j.partnerShopId === partner.id)
    .map(jobForPartner);

  const stages = (db.stages || []).slice().sort((a, b) => a.order - b.order);

  return NextResponse.json({
    company: { name: db.settings.companyName, currency: db.settings.currency || "€" },
    partner: { id: partner.id, name: partner.name },
    stages,
    jobs,
  });
}
