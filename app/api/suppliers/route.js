import { NextResponse } from "next/server";
import { list, insert } from "@/lib/db";

export async function GET() {
  return NextResponse.json(list("suppliers"));
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.nameRequired" }, { status: 400 });
  }
  const rec = insert("suppliers", {
    name: body.name.trim(),
    afm: body.afm || "",
    profession: body.profession || "",
    address: body.address || "",
    city: body.city || "",
    phone: body.phone || "",
    email: body.email || "",
    notes: body.notes || "",
  });
  return NextResponse.json(rec, { status: 201 });
}
