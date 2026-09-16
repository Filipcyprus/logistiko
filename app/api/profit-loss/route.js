import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { profitLoss } from "@/lib/reports";

// Κατάσταση Αποτελεσμάτων — για διάστημα, αναλυτικά ανά λογαριασμό εσόδου/εξόδου.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  return NextResponse.json(profitLoss(db, from, to));
}
