import { NextResponse } from "next/server";
import { readDB, insert } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const VALID_ROLES = ["manager", "cashier"];

async function requireOwner(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return session?.role === "owner";
}

// Λίστα λογαριασμών προσωπικού (manager/cashier — όχι τον owner, χωρίς κωδικούς).
export async function GET(request) {
  if (!(await requireOwner(request))) return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  const db = readDB();
  const users = (db.users || []).filter((u) => u.role !== "owner").map(({ passwordHash, ...rest }) => rest);
  return NextResponse.json(users);
}

// Δημιουργία νέου λογαριασμού προσωπικού (manager ή cashier).
// Εξαίρεση bootstrap: αν δεν υπάρχει ΚΑΝΕΝΑΣ χρήστης ακόμα, επιτρέπεται η δημιουργία
// του πρώτου λογαριασμού (owner) χωρίς σύνδεση — κλείνει αυτόματα μόλις υπάρξει ο πρώτος.
export async function POST(request) {
  const db = readDB();
  const isBootstrap = (db.users || []).length === 0;

  if (!isBootstrap && !(await requireOwner(request))) {
    return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) return NextResponse.json({ error: "errors.usernamePasswordRequired" }, { status: 400 });

  if ((db.users || []).some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return NextResponse.json({ error: "errors.usernameTaken" }, { status: 400 });
  }

  const role = isBootstrap ? "owner" : (VALID_ROLES.includes(body.role) ? body.role : "cashier");
  const rec = insert("users", {
    username,
    passwordHash: hashPassword(password),
    role,
    ...(role === "cashier" ? { canDiscount: !!body.canDiscount } : {}),
  });
  const { passwordHash, ...safe } = rec;
  return NextResponse.json(safe, { status: 201 });
}
