// "Το κατάστημα ανοίγει σύντομα" για τον σύνδεσμο B2B: όσο δεν έχει έρθει η ώρα έναρξης, οι πελάτες βλέπουν
// ενημερωτική σελίδα αντί για τον κατάλογο και δεν μπορούν να στείλουν παραγγελία. Μόλις περάσει η ώρα,
// το κατάστημα ανοίγει από μόνο του (χωρίς να χρειάζεται να πατήσει κανείς κάτι).
//
// Ρυθμίσεις (Ρυθμίσεις → B2B portal):
//   b2bOpeningEnabled     true/false
//   b2bOpensAt            "YYYY-MM-DDTHH:mm" — ώρα Κύπρου (Europe/Nicosia)
//   b2bOpeningMessageEn / b2bOpeningMessageEl   προαιρετικό δικό σου κείμενο (αλλιώς μπαίνει το προεπιλεγμένο)

const TZ = "Europe/Nicosia";

function offsetMsAt(utcMs) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMs)).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-09-28T19:00" (ώρα Κύπρου) → στιγμή σε UTC milliseconds. null αν η τιμή δεν είναι έγκυρη.
export function nicosiaLocalToUtcMs(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(str || ""));
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  let guess = asUtc - offsetMsAt(asUtc);
  guess = asUtc - offsetMsAt(guess); // δεύτερο πέρασμα: σωστό και γύρω από την αλλαγή ώρας
  return guess;
}

export function portalOpeningState(settings, now = Date.now()) {
  const s = settings || {};
  if (!s.b2bOpeningEnabled) return { closed: false };
  const opensAtMs = nicosiaLocalToUtcMs(s.b2bOpensAt);
  if (opensAtMs == null) return { closed: false };
  return { closed: now < opensAtMs, opensAtMs, messageEn: s.b2bOpeningMessageEn || "", messageEl: s.b2bOpeningMessageEl || "" };
}
