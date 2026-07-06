import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { logActivity } from "@/lib/audit";

export async function POST(request) {
  const { username, password } = await request.json();
  const db = readDB();
  const user = (db.users || []).find((u) => u.username.toLowerCase() === String(username || "").trim().toLowerCase());

  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    await logActivity(request, "login_failed", { username: username || "" }, { username: "", role: "" });
    return NextResponse.json({ error: "errors.invalidCredentials" }, { status: 401 });
  }

  const token = await createSessionToken({
    username: user.username,
    role: user.role,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });

  await logActivity(request, "login", {}, { username: user.username, role: user.role });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
