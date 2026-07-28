import fs from "fs";
import path from "path";
import { uid } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function sanitizeName(name) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

// Άμυνα: ό,τι έρθει ακόμα ως ενσωματωμένο base64 (π.χ. από παλιό/μη ανανεωμένο tab στον
// browser) μετατρέπεται σε πραγματικό αρχείο στο δίσκο πριν μπει στη βάση, ώστε το db.json
// να μη φουσκώνει ξανά ανεξάρτητα από το ποιος client στέλνει τα δεδομένα.
export function migrateInlineDesigns(designs) {
  if (!Array.isArray(designs)) return [];
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return designs.map((d) => {
    if (d.dataUrl && typeof d.dataUrl === "string" && d.dataUrl.startsWith("data:")) {
      const m = d.dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
      if (m) {
        const buf = Buffer.from(m[2], "base64");
        const filename = `${uid()}-${sanitizeName(d.name)}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
        return { id: d.id || uid(), name: d.name || "", type: d.type || m[1] || "", url: `/api/uploads/${filename}` };
      }
    }
    return { id: d.id || uid(), name: d.name || "", type: d.type || "", url: d.url || "" };
  });
}
