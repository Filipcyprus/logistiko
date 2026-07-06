import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ error: "errors.unauthorized" }, { status: 401 });

  const db = readDB();
  const user = (db.users || []).find((u) => u.username === session.username);
  return NextResponse.json({
    username: session.username,
    role: session.role,
    canDiscount: user?.canDiscount ?? session.role !== "cashier",
  });
}
