import { NextResponse } from "next/server";
import { writeDB } from "@/lib/db";

// Επαναφορά από αντίγραφο ασφαλείας (ανεβασμένο JSON).
export async function POST(request) {
  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "errors.invalidBackup" }, { status: 400 });
  }
  // Στοιχειώδης έλεγχος ότι μοιάζει με βάση της εφαρμογής.
  if (!data || typeof data !== "object" || !data.settings || !Array.isArray(data.invoices)) {
    return NextResponse.json({ error: "errors.invalidBackup" }, { status: 400 });
  }
  writeDB(data);
  return NextResponse.json({ ok: true });
}
