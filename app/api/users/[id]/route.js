import { NextResponse } from "next/server";
import { remove } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

async function requireOwner(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return session?.role === "owner";
}

export async function DELETE(request, { params }) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  remove("users", params.id);
  return NextResponse.json({ ok: true });
}
