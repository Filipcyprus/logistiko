import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const type = searchParams.get("type");
  let list = readDB().activities || [];
  if (customerId) list = list.filter((a) => a.customerId === customerId);
  if (type) list = list.filter((a) => a.type === type);
  return NextResponse.json(list);
}

export async function POST(request) {
  const body = await request.json();
  const db = readDB();
  const rec = {
    id: uid(),
    customerId: body.customerId || null,
    type: body.type || "note", // note | reminder | email | activity
    date: body.date || new Date().toISOString().slice(0, 10),
    dueDate: body.dueDate || "",
    title: body.title || "",
    note: body.note || "",
    tags: Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(",").map((t) => t.trim()).filter(Boolean) : []),
    done: !!body.done,
    createdAt: new Date().toISOString(),
  };
  db.activities.unshift(rec);
  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}
