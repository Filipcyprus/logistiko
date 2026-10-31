import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDB();
  return NextResponse.json(db.commissionInvoices || []);
}
