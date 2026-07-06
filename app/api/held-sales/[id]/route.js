import { NextResponse } from "next/server";
import { remove } from "@/lib/db";

export async function DELETE(_req, { params }) {
  remove("heldSales", params.id);
  return NextResponse.json({ ok: true });
}
