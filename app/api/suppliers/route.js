import { NextResponse } from "next/server";
import { list, readDB, writeDB, uid } from "@/lib/db";

export async function GET() {
  return NextResponse.json(list("suppliers"));
}

// Κάθε προμηθευτής παίρνει έναν μοναδικό, συνεχόμενο κωδικό (π.χ. SUP-00001) — ώστε να
// εντοπίζεται εύκολα σε αναφορές/λογιστικές εγγραφές, ίδια λογική με τους αριθμούς παραστατικών.
export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.nameRequired" }, { status: 400 });
  }
  const db = readDB();
  const seq = db.counters.supplier || 1;
  const code = `${db.settings.supplierPrefix || "SUP-"}${String(seq).padStart(5, "0")}`;
  const rec = {
    id: uid(),
    code,
    name: body.name.trim(),
    afm: body.afm || "",
    profession: body.profession || "",
    address: body.address || "",
    city: body.city || "",
    phone: body.phone || "",
    email: body.email || "",
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };
  db.suppliers = [rec, ...(db.suppliers || [])];
  db.counters.supplier = seq + 1;
  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}
