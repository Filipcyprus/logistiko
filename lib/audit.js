import { readDB, writeDB, uid } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const MAX_ENTRIES = 5000;

// Προσθέτει μια εγγραφή στο ιστορικό μέσα σε ήδη ανοιχτό αντικείμενο db (ο καλών το αποθηκεύει).
export function pushActivity(db, action, details = {}, session = null) {
  db.activityLog = db.activityLog || [];
  db.activityLog.unshift({
    id: uid(),
    createdAt: new Date().toISOString(),
    username: session?.username || "",
    role: session?.role || "",
    action,
    details,
  });
  if (db.activityLog.length > MAX_ENTRIES) db.activityLog.length = MAX_ENTRIES;
}

// Καταγράφει ένα σημαντικό γεγονός στο ιστορικό δραστηριότητας (μόνο ο owner το βλέπει).
export async function logActivity(request, action, details = {}, sessionOverride = null) {
  let session = sessionOverride;
  if (!session) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    session = await verifySessionToken(token);
  }
  const db = readDB();
  pushActivity(db, action, details, session);
  writeDB(db);
}
