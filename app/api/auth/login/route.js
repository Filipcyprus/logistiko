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
    linkedId: user.linkedId || null,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });

  await logActivity(request, "login", {}, { username: user.username, role: user.role });

  // Οι λογαριασμοί partner/consignment δεν έχουν πρόσβαση στη ρίζα "/" — στείλε τους
  // κατευθείαν στο δικό τους portal, ώστε η σύνδεση να δουλεύει από οπουδήποτε (όχι μόνο
  // αν μπουν από τον συγκεκριμένο σύνδεσμο του portal τους).
  let redirectPath = null;
  if (user.role === "consignment") {
    redirectPath = "/consignment-portal";
  } else if (user.role === "partner") {
    const shop = (db.partnerShops || []).find((p) => p.id === user.linkedId);
    if (shop?.portalToken) redirectPath = `/partner-portal/${shop.portalToken}`;
  } else if (user.role === "accountant") {
    redirectPath = "/logistis";
  }

  const res = NextResponse.json({ ok: true, role: user.role, redirectPath });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
