import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET() {
  const db = readDB();
  return new NextResponse(JSON.stringify(db, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="logistiko-backup.json"`,
    },
  });
}
