import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // active | done
  let jobs = readDB().jobs || [];
  if (status) jobs = jobs.filter((j) => (j.status || "active") === status);
  return NextResponse.json(jobs);
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();

  const stages = (db.stages || []).slice().sort((a, b) => a.order - b.order);
  const firstStage = stages[0]?.id || null;
  const stageId = body.stageId || firstStage;

  const seq = db.counters.job || 1;
  const number = `JOB-${String(seq).padStart(5, "0")}`;

  let customerName = "";
  if (body.customerId) {
    customerName = db.customers.find((c) => c.id === body.customerId)?.name || "";
  }

  const job = {
    id: uid(),
    number,
    title: body.title || "",
    customerId: body.customerId || null,
    customerName,
    stageId,
    priority: body.priority || "normal",
    dueDate: body.dueDate || "",
    assignedTo: body.assignedTo || "",
    quantity: body.quantity || "",
    unit: body.unit || "",
    linkedType: body.linkedType || null,
    linkedId: body.linkedId || null,
    linkedNumber: body.linkedNumber || "",
    notes: body.notes || "",
    status: "active",
    history: [{ stageId, at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  db.jobs.unshift(job);
  db.counters.job = seq + 1;
  writeDB(db);
  return NextResponse.json(job, { status: 201 });
}
