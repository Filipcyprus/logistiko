import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { logActivity } from "@/lib/audit";

export async function POST(request) {
  await logActivity(request, "logout");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
