import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDB, writeDB } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Αναγκάζει το route να παραμένει δυναμικό — αλλιώς το Next.js το κάνει static
// optimization (μόνο GET) και το PUT επιστρέφει 405.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDB();
  // Μόνο ο owner βλέπει τους κωδικούς αποστολής email — ταμίες/διαχειριστές χρειάζονται τις υπόλοιπες ρυθμίσεις.
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (session?.role !== "owner" && db.settings.mail) {
    return NextResponse.json({ ...db.settings, mail: { ...db.settings.mail, pass: "", relaySecret: "" } });
  }
  return NextResponse.json(db.settings);
}

export async function PUT(request) {
  const patch = await request.json();
  const db = readDB();
  db.settings = { ...db.settings, ...patch };
  writeDB(db);
  return NextResponse.json(db.settings);
}
