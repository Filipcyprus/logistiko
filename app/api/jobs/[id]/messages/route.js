import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

// Προσθήκη μηνύματος από τον ιδιοκτήτη προς τον συνεργάτη τυπογραφείο.
export async function POST(request, { params }) {
  const body = await request.json();
  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const db = readDB();
  const job = db.jobs.find((x) => x.id === params.id);
  if (!job) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const message = {
    id: uid(),
    author: "owner",
    authorName: body.authorName || "",
    text: body.text.trim(),
    createdAt: new Date().toISOString(),
  };
  job.messages = [...(job.messages || []), message];
  writeDB(db);
  return NextResponse.json(job, { status: 201 });
}
