import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { uid } from "@/lib/db";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function sanitizeName(name) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

// Αποθήκευση επισυναπτόμενων αρχείων (σχέδια εργασιών) ως πραγματικά αρχεία στο δίσκο,
// όχι ενσωματωμένα ως base64 μέσα στη βάση JSON — αλλιώς η βάση φουσκώνει και όλο το
// app επιβραδύνεται, αφού κάθε αίτημα διαβάζει/γράφει ολόκληρο το db.json.
export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const filename = `${uid()}-${sanitizeName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  return NextResponse.json({ url: `/api/uploads/${filename}`, name: file.name, type: file.type, size: buffer.length });
}
