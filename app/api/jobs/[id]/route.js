import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { migrateInlineDesigns } from "@/lib/uploads";

export async function GET(_req, { params }) {
  const job = (readDB().jobs || []).find((x) => x.id === params.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(job);
}

function addSystemMessage(job, author, text) {
  job.messages = [...(job.messages || []), { id: uid(), author, authorName: "", text, system: true, createdAt: new Date().toISOString() }];
}

export async function PUT(request, { params }) {
  const patch = await request.json();
  const db = readDB();
  const job = db.jobs.find((x) => x.id === params.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  // Τα μηνύματα/ιστορικό διαχειρίζονται αποκλειστικά εδώ (server-side) — ποτέ από ολόκληρη φόρμα εργασίας
  // που έστειλε ο χρήστης, αλλιώς μια παλιά (stale) αντιγραφή θα έσβηνε μηνύματα που ήρθαν στο μεταξύ.
  delete patch.messages;
  delete patch.history;

  // Άμυνα κατά της διόγκωσης της βάσης: αν ο client (π.χ. παλιό/μη ανανεωμένο tab)
  // στείλει σχέδια με ενσωματωμένο base64 αντί για url, μετέτρεψέ τα σε αρχεία στο δίσκο.
  if (Array.isArray(patch.designs)) {
    patch.designs = migrateInlineDesigns(patch.designs);
  }

  const notifyPartner = !!(job.partnerShopId || patch.partnerShopId);

  // Αλλαγή σταδίου → κατέγραψε στο ιστορικό + ειδοποίηση συνεργάτη
  if (patch.stageId && patch.stageId !== job.stageId) {
    job.history = [...(job.history || []), { stageId: patch.stageId, at: new Date().toISOString() }];
    if (notifyPartner) {
      const stageName = (db.stages || []).find((s) => s.id === patch.stageId)?.name || patch.stageId;
      addSystemMessage(job, "owner", `Stage changed to: ${stageName}`);
    }
  }
  // Ενημέρωση ονόματος πελάτη αν άλλαξε ο πελάτης
  if (patch.customerId !== undefined) {
    job.customerName = patch.customerId ? (db.customers.find((c) => c.id === patch.customerId)?.name || "") : "";
  }
  // Ενημέρωση ονόματος συνεργάτη αν άλλαξε το partner shop
  if (patch.partnerShopId !== undefined) {
    const wasAssigned = !!job.partnerShopId;
    job.partnerShopName = patch.partnerShopId ? (db.partnerShops.find((p) => p.id === patch.partnerShopId)?.name || "") : "";
    if (patch.partnerShopId && patch.partnerShopId !== job.partnerShopId && !wasAssigned) {
      addSystemMessage(job, "owner", "Job assigned to you.");
    }
  }
  // Ολοκλήρωση
  if (patch.status === "done" && job.status !== "done") {
    job.completedAt = new Date().toISOString();
    if (notifyPartner) addSystemMessage(job, "owner", "Marked job as done.");
  }
  if (patch.status === "active" && job.status !== "active") {
    job.completedAt = null;
    if (notifyPartner) addSystemMessage(job, "owner", "Reopened job.");
  }

  // Ελάχιστο περιθώριο 20% — ίδιος κανόνας με τη δημιουργία, ώστε να μην παρακάμπτεται με απευθείας κλήση του API.
  if (patch.markupPercent !== undefined) {
    patch.markupPercent = Math.max(20, Number(patch.markupPercent) || 0);
  }

  Object.assign(job, patch);
  writeDB(db);
  return NextResponse.json(job);
}

export async function DELETE(_req, { params }) {
  const db = readDB();
  db.jobs = db.jobs.filter((x) => x.id !== params.id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
