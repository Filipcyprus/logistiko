import { NextResponse } from "next/server";
import { list, insert } from "@/lib/db";

export async function GET() {
  return NextResponse.json(list("expenses"));
}

export async function POST(request) {
  const body = await request.json();
  if (!body.description || !body.description.trim()) {
    return NextResponse.json({ error: "errors.descriptionRequired" }, { status: 400 });
  }
  const rec = insert("expenses", {
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || "general",
    description: body.description.trim(),
    supplier: body.supplier || "",
    net: Number(body.net || 0),
    vat: Number(body.vat || 0),
    amount: Number(body.amount || 0),
    paymentMethod: body.paymentMethod || "cash",
    notes: body.notes || "",
  });
  return NextResponse.json(rec, { status: 201 });
}
