import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { migrateInlineDesigns } from "@/lib/uploads";

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

  // Το όνομα πελάτη γράφεται ελεύθερα (δεν απαιτεί επιλογή υπάρχοντος πελάτη) — αν όμως
  // επιλέχθηκε πελάτης από τη λίστα και δεν γράφτηκε κάτι χειροκίνητα, γέμισε από εκεί.
  let customerName = body.customerName || "";
  if (!customerName && body.customerId) {
    customerName = db.customers.find((c) => c.id === body.customerId)?.name || "";
  }
  const customerPhone = body.customerPhone || "";
  let partnerShopName = "";
  if (body.partnerShopId) {
    partnerShopName = db.partnerShops.find((p) => p.id === body.partnerShopId)?.name || "";
  }

  const job = {
    id: uid(),
    number,
    title: body.title || "",
    customerId: body.customerId || null,
    customerName,
    // Προσωπικά στοιχεία πελάτη — ΜΟΝΟ για εσωτερική χρήση, ποτέ μην τα προσθέσεις στο ό,τι
    // βλέπει ο συνεργάτης τυπογραφείο (δες lib/jobs.js -> jobForPartner).
    customerPhone,
    partnerShopId: body.partnerShopId || null,
    partnerShopName,
    messages: [],
    stageId,
    priority: body.priority || "normal",
    dueDate: body.dueDate || "",
    assignedTo: body.assignedTo || "",
    items: Array.isArray(body.items) ? body.items.map((it) => ({ id: it.id || uid(), description: it.description || "", quantity: it.quantity || "", unit: it.unit || "", partnerUnitPrice: null, partnerVatRate: null })).filter((it) => it.description || it.quantity) : [],
    // Ελάχιστο ποσοστό προμήθειας 20% — δεν επιτρέπεται να πέσει κάτω, ακόμα κι αν κληθεί το API απευθείας.
    commissionPercent: Math.max(20, Number(body.commissionPercent ?? body.markupPercent) || 0),
    designs: migrateInlineDesigns(body.designs),
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
