import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { balanceSheetGrouped } from "@/lib/reports";

// Ισολογισμός — "έως" ημερομηνία, αναλυτικά ανά λογαριασμό.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  return NextResponse.json(balanceSheetGrouped(db, asOf));
}
