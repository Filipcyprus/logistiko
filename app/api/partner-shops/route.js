import { NextResponse } from "next/server";
import { list, insert } from "@/lib/db";

function genToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export async function GET() {
  return NextResponse.json(list("partnerShops"));
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.nameRequired" }, { status: 400 });
  }
  const rec = insert("partnerShops", {
    name: body.name.trim(),
    contact: body.contact || "",
    phone: body.phone || "",
    email: body.email || "",
    notes: body.notes || "",
    portalToken: genToken(),
    portalEnabled: true,
  });
  return NextResponse.json(rec, { status: 201 });
}
