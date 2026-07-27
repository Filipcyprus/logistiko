import { NextResponse } from "next/server";
import { list, insert } from "@/lib/db";

export async function GET() {
  return NextResponse.json(list("consignmentStores"));
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "errors.nameRequired" }, { status: 400 });
  }
  const rec = insert("consignmentStores", {
    name: body.name.trim(),
    address: body.address || "",
    phone: body.phone || "",
    contact: body.contact || "",
    notes: body.notes || "",
  });
  return NextResponse.json(rec, { status: 201 });
}
