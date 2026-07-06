import { NextResponse } from "next/server";
import { getById, remove } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logActivity } from "@/lib/audit";

async function requireOwner(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return session?.role === "owner";
}

export async function DELETE(request, { params }) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  const existing = getById("users", params.id);
  remove("users", params.id);
  await logActivity(request, "staff_delete", { targetUsername: existing?.username || "" });
  return NextResponse.json({ ok: true });
}
