import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Επαλήθευση session για portal συνεργάτη/καταστήματος παρακαταθήκης.
// Επιστρέφει το session μόνο αν ο ρόλος ταιριάζει ΚΑΙ (αν δοθεί matchId) το linkedId αντιστοιχεί
// στη συγκεκριμένη οντότητα (partner shop / consignment store) — αλλιώς null, ώστε το route
// να απαντήσει με errors.loginRequired και το frontend να δείξει φόρμα σύνδεσης.
export async function verifyPortalSession(request, role, matchId = null) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || session.role !== role) return null;
  if (matchId && session.linkedId !== matchId) return null;
  return session;
}
