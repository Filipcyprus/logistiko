import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { cashFlow } from "@/lib/reports";

// Κατάσταση Ταμειακών Ροών — η τρίτη βασική λογιστική κατάσταση (μαζί με Αποτελέσματα/Ισολογισμό).
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  return NextResponse.json(cashFlow(db, from, to));
}
