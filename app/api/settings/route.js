import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

// Αναγκάζει το route να παραμένει δυναμικό — αλλιώς το Next.js το κάνει static
// optimization (μόνο GET) και το PUT επιστρέφει 405.
export const dynamic = "force-dynamic";

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
