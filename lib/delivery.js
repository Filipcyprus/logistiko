// Δωρεάν παράδοση στη Λευκωσία σε συγκεκριμένες ημέρες/ώρες (B2B portal).
// Ρύθμιση στη βάση: settings.freeDeliveryNicosia = { enabled, slots: [{ day, from, to }] } — day: 0=Κυριακή … 6=Σάββατο.
// Οι ώρες είναι ώρα Κύπρου (Europe/Nicosia). Χωρίς ρύθμιση ισχύει η προεπιλογή παρακάτω.
import { nicosiaLocalToUtcMs } from "@/lib/portalOpening";

export const DEFAULT_FREE_DELIVERY = {
  enabled: true,
  slots: [
    { day: 3, from: "18:00", to: "19:00" }, // Τετάρτη
    { day: 5, from: "18:00", to: "19:00" }, // Παρασκευή
    { day: 6, from: "14:30", to: "17:00" }, // Σάββατο
  ],
};

export function freeDeliveryConfig(settings) {
  const c = settings && settings.freeDeliveryNicosia;
  if (!c) return DEFAULT_FREE_DELIVERY;
  return { enabled: c.enabled !== false, slots: Array.isArray(c.slots) ? c.slots : DEFAULT_FREE_DELIVERY.slots };
}

const pad = (n) => String(n).padStart(2, "0");

// Ημερομηνία (YYYY-MM-DD) και ημέρα εβδομάδας τη στιγμή `ms`, σε ώρα Κύπρου.
function nicosiaDateParts(ms) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date(ms)).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd };
}

// Οι επόμενες διαθέσιμες ώρες παράδοσης: μόνο όσες ξεκινούν τουλάχιστον `leadHours` από τώρα.
export function upcomingDeliverySlots(config, nowMs = Date.now(), { count = 8, leadHours = 24, horizonDays = 35 } = {}) {
  if (!config || config.enabled === false || !config.slots || !config.slots.length) return [];
  const out = [];
  const base = nicosiaDateParts(nowMs);
  for (let i = 0; i <= horizonDays && out.length < count; i++) {
    const utc = Date.UTC(base.y, base.m - 1, base.d + i, 12); // μεσημέρι UTC της ημέρας: ασφαλές για την ημερομηνία στην Κύπρο
    const p = nicosiaDateParts(utc);
    const date = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
    for (const s of config.slots.filter((x) => Number(x.day) === p.wd).sort((a, b) => a.from.localeCompare(b.from))) {
      const startMs = nicosiaLocalToUtcMs(`${date}T${s.from}`);
      if (startMs != null && startMs - nowMs >= leadHours * 3600000) out.push({ key: `${date}|${s.from}`, date, from: s.from, to: s.to, startMs });
      if (out.length >= count) break;
    }
  }
  return out;
}

// Το όνομα της πόλης του πελάτη δείχνει Λευκωσία; (κενό = δεν ξέρουμε → επιτρέπεται)
export function looksLikeNicosia(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return true;
  return /nicosia|lefkosia|lefkosa|λευκωσ/.test(c.normalize("NFD").replace(/[̀-ͯ]/g, "")) || /nicosia|lefkosia|lefkosa|λευκωσ/.test(c);
}

// "Τετάρτη 18:00–19:00 · Παρασκευή 18:00–19:00 · Σάββατο 14:30–17:00" (στη γλώσσα του επισκέπτη).
export function slotsSummary(slots, locale = "en-GB") {
  return [...(slots || [])].sort((a, b) => ((Number(a.day) + 6) % 7) - ((Number(b.day) + 6) % 7) || a.from.localeCompare(b.from))
    .map((s) => {
      const name = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 27 + Number(s.day), 12))); // 27/9/2026 = Κυριακή
      return `${name} ${s.from}–${s.to}`;
    }).join(" · ");
}
