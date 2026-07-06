import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logActivity } from "@/lib/audit";

// Κλείσιμο βάρδιας: υπολογίζει το αναμενόμενο μετρητό (αρχικό ταμείο + μετρητοίς πωλήσεις
// κατά τη διάρκεια της βάρδιας) και το συγκρίνει με το μετρημένο ποσό που δηλώνει ο ταμίας.
export async function PUT(request, { params }) {
  const db = readDB();
  const shift = (db.shifts || []).find((s) => s.id === params.id);
  if (!shift) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (shift.status !== "open") return NextResponse.json({ error: "errors.shiftAlreadyClosed" }, { status: 400 });

  const body = await request.json();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  const cashSales = (db.invoices || [])
    .filter((inv) => inv.shiftId === shift.id && inv.paymentMethod === "cash")
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  const expectedCash = Math.round((Number(shift.openingFloat || 0) + cashSales) * 100) / 100;
  const countedCash = Number(body.countedCash || 0);

  Object.assign(shift, {
    status: "closed",
    closedAt: new Date().toISOString(),
    closedBy: session?.username || "",
    countedCash,
    expectedCash,
    difference: Math.round((countedCash - expectedCash) * 100) / 100,
  });

  writeDB(db);
  await logActivity(request, "shift_close", { expectedCash: shift.expectedCash, countedCash: shift.countedCash, difference: shift.difference });
  return NextResponse.json(shift);
}
