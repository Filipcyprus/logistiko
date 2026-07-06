// Υπογραφή/επαλήθευση session token με Web Crypto API.
// Λειτουργεί τόσο σε Node.js (API routes) όσο και σε Edge runtime (middleware).

const SECRET = process.env.SESSION_SECRET || "logistiko-dev-secret-change-me";

function toBase64Url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function getKey() {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(payload) {
  const enc = new TextEncoder();
  const dataB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${dataB64}.${sigB64}`;
}

export async function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [dataB64, sigB64] = token.split(".");
  if (!dataB64 || !sigB64) return null;
  try {
    const key = await getKey();
    const enc = new TextEncoder();
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigB64), enc.encode(dataB64));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(dataB64)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "lgt_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
