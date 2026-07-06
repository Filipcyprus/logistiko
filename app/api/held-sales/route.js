import { NextResponse } from "next/server";
import { list, insert } from "@/lib/db";

export async function GET() {
  return NextResponse.json(list("heldSales"));
}

export async function POST(request) {
  const body = await request.json();
  const rec = insert("heldSales", {
    label: body.label || "",
    customerId: body.customerId || "",
    cart: body.cart || [],
  });
  return NextResponse.json(rec, { status: 201 });
}
