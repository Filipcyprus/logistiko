import { NextResponse } from "next/server";
import { list } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (session?.role !== "owner") return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  return NextResponse.json(list("activityLog"));
}
