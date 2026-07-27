import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { jobQuoteTotal } from "@/lib/jobs";
import { verifyPortalSession } from "@/lib/portalAuth";

function addSystemMessage(job, author, authorName, text) {
  job.messages = [...(job.messages || []), { id: uid(), author, authorName, text, system: true, createdAt: new Date().toISOString() }];
}

// Ενημέρωση σταδίου/κατάστασης εργασίας από τον συνεργάτη τυπογραφείο.
export async function PUT(request, { params }) {
  const body = await request.json();
  const db = readDB();
  const partner = (db.partnerShops || []).find((p) => p.portalEnabled && p.portalToken === params.token);
  if (!partner) return NextResponse.json({ error: "errors.invalidLink" }, { status: 404 });

  const session = await verifyPortalSession(request, "partner", partner.id);
  if (!session) return NextResponse.json({ error: "errors.loginRequired" }, { status: 401 });

  const job = db.jobs.find((x) => x.id === params.jobId && x.partnerShopId === partner.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  if (body.stageId && body.stageId !== job.stageId) {
    job.history = [...(job.history || []), { stageId: body.stageId, at: new Date().toISOString() }];
    job.stageId = body.stageId;
    const stageName = (db.stages || []).find((s) => s.id === body.stageId)?.name || body.stageId;
    addSystemMessage(job, "partner", partner.name, `Stage changed to: ${stageName}`);
  }
  if (body.status === "done" && job.status !== "done") {
    job.status = "done";
    job.completedAt = new Date().toISOString();
    addSystemMessage(job, "partner", partner.name, "Marked job as done.");
  }
  if (Array.isArray(body.itemPricing)) {
    const priceMap = new Map(body.itemPricing.map((p) => [p.id, p]));
    job.items = (job.items || []).map((it) => {
      const p = priceMap.get(it.id);
      if (!p) return it;
      return {
        ...it,
        partnerUnitPrice: p.unitPrice !== "" && p.unitPrice != null ? Number(p.unitPrice) : null,
        partnerVatRate: p.vatRate !== "" && p.vatRate != null ? Number(p.vatRate) : null,
      };
    });
    job.partnerQuoteSubmittedAt = new Date().toISOString();
    const total = jobQuoteTotal(job.items);
    addSystemMessage(job, "partner", partner.name, total != null ? `Submitted pricing — total: €${total.toFixed(2)}` : "Submitted pricing.");

    // Μόλις δοθεί τιμή, αν η δουλειά είναι ακόμα στο πρώτο στάδιο (αναμονή τιμής/προσφοράς),
    // προχώρα αυτόματα στο επόμενο στάδιο — δεν χρειάζεται ο συνεργάτης να το μετακινήσει με το χέρι.
    if (total != null) {
      const sortedStages = (db.stages || []).slice().sort((a, b) => a.order - b.order);
      const firstStageId = sortedStages[0]?.id;
      const nextStage = sortedStages[1];
      if (nextStage && job.stageId === firstStageId) {
        job.history = [...(job.history || []), { stageId: nextStage.id, at: new Date().toISOString() }];
        job.stageId = nextStage.id;
        addSystemMessage(job, "partner", partner.name, `Auto-moved to: ${nextStage.name}`);
      }
    }
  }

  writeDB(db);
  return NextResponse.json(job);
}
