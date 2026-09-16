import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { arAging, apAging } from "@/lib/reports";

// Ενηλικίωση υπολοίπων — ?kind=ar (πελάτες) ή ?kind=ap (προμηθευτές).
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const kind = searchParams.get("kind") === "ap" ? "ap" : "ar";
  return NextResponse.json(kind === "ap" ? apAging(db, asOf) : arAging(db, asOf));
}
