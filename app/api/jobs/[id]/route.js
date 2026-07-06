import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function GET(_req, { params }) {
  const job = (readDB().jobs || []).find((x) => x.id === params.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PUT(request, { params }) {
  const patch = await request.json();
  const db = readDB();
  const job = db.jobs.find((x) => x.id === params.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  // Αλλαγή σταδίου → κατέγραψε στο ιστορικό
  if (patch.stageId && patch.stageId !== job.stageId) {
    job.history = [...(job.history || []), { stageId: patch.stageId, at: new Date().toISOString() }];
  }
  // Ενημέρωση ονόματος πελάτη αν άλλαξε ο πελάτης
  if (patch.customerId !== undefined) {
    job.customerName = patch.customerId ? (db.customers.find((c) => c.id === patch.customerId)?.name || "") : "";
  }
  // Ολοκλήρωση
  if (patch.status === "done" && job.status !== "done") {
    job.completedAt = new Date().toISOString();
  }
  if (patch.status === "active") {
    job.completedAt = null;
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
