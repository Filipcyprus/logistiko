import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

export async function GET() {
  const db = readDB();
  return NextResponse.json(db.settings);
}

export async function PUT(request) {
  const patch = await request.json();
  const db = readDB();
  db.settings = { ...db.settings, ...patch };
  writeDB(db);
  return NextResponse.json(db.settings);
}
