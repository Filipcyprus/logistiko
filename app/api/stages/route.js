import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  const stages = (readDB().stages || []).slice().sort((a, b) => a.order - b.order);
  return NextResponse.json(stages);
}

// Προσθήκη νέου σταδίου
export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.stageNameRequired" }, { status: 400 });
  }
  const db = readDB();
  const maxOrder = Math.max(-1, ...(db.stages || []).map((s) => s.order));
  const rec = { id: uid(), name: body.name.trim(), color: body.color || "slate", order: maxOrder + 1 };
  db.stages = [...(db.stages || []), rec];
  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}

// Αντικατάσταση όλης της λίστας (μετονομασία / αναδιάταξη / χρώματα)
export async function PUT(request) {
  const body = await request.json();
  if (!Array.isArray(body.stages)) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }
  const db = readDB();
  db.stages = body.stages.map((s, i) => ({
    id: s.id || uid(),
    name: s.name,
    color: s.color || "slate",
    order: i,
  }));
  writeDB(db);
  return NextResponse.json(db.stages);
}

// Διαγραφή σταδίου (μετακινεί τις εργασίες του στο πρώτο στάδιο)
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const db = readDB();
  if ((db.stages || []).length <= 1) {
    return NextResponse.json({ error: "errors.atLeastOneStage" }, { status: 400 });
  }
  db.stages = (db.stages || []).filter((s) => s.id !== id).sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
  const fallback = db.stages[0].id;
  for (const j of db.jobs || []) {
    if (j.stageId === id) j.stageId = fallback;
  }
  writeDB(db);
  return NextResponse.json(db.stages);
}
