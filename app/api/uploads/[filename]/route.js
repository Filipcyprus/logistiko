import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Next.js σερβίρει το /public μόνο με τη λίστα αρχείων που είχε κατά την εκκίνηση του
// server — ένα αρχείο που ανεβαίνει ενώ ο server ήδη τρέχει (π.χ. σχέδιο εργασίας) γύριζε
// 404 μέχρι το επόμενο restart. Σερβίρισμα εδώ μέσω route διαβάζει το δίσκο σε κάθε αίτημα.
export async function GET(request, { params }) {
  const filename = params.filename;
  if (!filename || filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
