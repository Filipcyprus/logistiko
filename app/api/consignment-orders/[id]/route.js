import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const db = readDB();
  const order = (db.consignmentOrders || []).find((o) => o.id === params.id);
  if (!order) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (body.status) order.status = body.status;
  writeDB(db);
  return NextResponse.json(order);
}
