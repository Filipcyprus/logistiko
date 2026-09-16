import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { generalLedger } from "@/lib/reports";

// Καθολικό ενός λογαριασμού — κάθε κίνηση με τρέχον υπόλοιπο.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  if (!accountId) return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });

  const result = generalLedger(db, accountId, from, to);
  if (!result) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(result);
}
