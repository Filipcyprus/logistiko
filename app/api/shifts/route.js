import { NextResponse } from "next/server";
import { list, insert } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logActivity } from "@/lib/audit";

export async function GET() {
  return NextResponse.json(list("shifts"));
}

// Άνοιγμα νέας βάρδιας ταμείου (απορρίπτεται αν υπάρχει ήδη ανοιχτή).
export async function POST(request) {
  const shifts = list("shifts");
  if (shifts.some((s) => s.status === "open")) {
    return NextResponse.json({ error: "errors.shiftAlreadyOpen" }, { status: 400 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const body = await request.json();

  const rec = insert("shifts", {
    openedAt: new Date().toISOString(),
    openedBy: session?.username || "",
    openingFloat: Number(body.openingFloat || 0),
    status: "open",
    closedAt: null,
    closedBy: null,
    countedCash: null,
    expectedCash: null,
    difference: null,
  });
  await logActivity(request, "shift_open", { openingFloat: rec.openingFloat });
  return NextResponse.json(rec, { status: 201 });
}
