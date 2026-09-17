// Μετατρέπει τις ήδη ενσωματωμένες (base64) φωτογραφίες προϊόντων σε πραγματικά αρχεία στον
// δίσκο (public/uploads), αφήνοντας στο db.json μόνο τον σύνδεσμο. Οι φωτογραφίες αυτές μπήκαν
// πριν το ProductForm αλλάξει να ανεβάζει μέσω /api/uploads — αυτό εδώ καθαρίζει το ιστορικό.
//
// Ασφαλές να ξανατρέξει: ό,τι δεν ξεκινάει πια με "data:" το προσπερνάει.
//
// Χρήση:  node scripts/migrate-product-images.js           (δοκιμή, δεν γράφει τίποτα)
//         node scripts/migrate-product-images.js --apply   (εφαρμόζει)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(process.cwd(), "data", "db.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function uid() {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

function main() {
  const apply = process.argv.includes("--apply");
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));

  let converted = 0;
  let bytesSaved = 0;

  for (const p of db.products || []) {
    if (typeof p.image !== "string" || !p.image.startsWith("data:")) continue;

    const match = p.image.match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) {
      console.warn("  skip (unrecognised data URL) —", p.id, p.name);
      continue;
    }
    const [, mime, b64] = match;
    const ext = EXT_BY_MIME[mime] || "jpg";
    const buffer = Buffer.from(b64, "base64");
    const filename = `${uid()}-product-${p.id}.${ext}`;

    bytesSaved += p.image.length - `/api/uploads/${filename}`.length;
    converted++;
    console.log(`  ${p.name || p.id}: ${(p.image.length / 1024).toFixed(0)} KB -> ${filename}`);

    if (apply) {
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
      p.image = `/api/uploads/${filename}`;
    }
  }

  console.log(`\n${apply ? "Converted" : "Would convert"} ${converted} product image(s), ~${(bytesSaved / 1048576).toFixed(2)} MB out of db.json.`);

  if (apply && converted > 0) {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE);
    console.log("db.json updated.");
  } else if (!apply) {
    console.log("Dry run only — nothing written. Re-run with --apply to make the change.");
  }
}

main();
