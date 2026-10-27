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
    legalName: body.legalName || "",
    afm: body.afm || "",
    address: body.address || "",
    city: body.city || "",
    phone: body.phone || "",
    email: body.email || "",
    contact: body.contact || "",
    // Το ποσοστό κέρδους που δίνουμε στο κατάστημα για κάθε πώληση (π.χ. 20 = 20%). null = δεν έχει οριστεί.
    commissionPercent: body.commissionPercent === "" || body.commissionPercent == null ? null : Number(body.commissionPercent),
    notes: body.notes || "",
  });
  return NextResponse.json(rec, { status: 201 });
}
