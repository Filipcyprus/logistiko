// Ενημέρωση: δωρεάν παράδοση στη Λευκωσία σε συγκεκριμένες ημέρες/ώρες (εμφανίζεται ως σημείωση στο B2B portal).
// Ρύθμιση στη βάση: settings.freeDeliveryNicosia = { enabled, slots: [{ day, from, to }] } — day: 0=Κυριακή … 6=Σάββατο (ώρα Κύπρου).
// Χωρίς ρύθμιση ισχύει η προεπιλογή παρακάτω. Είναι ΜΟΝΟ πληροφορία — δεν είναι επιλογή στο καλάθι.

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

// "Τετάρτη 18:00–19:00 · Παρασκευή 18:00–19:00 · Σάββατο 14:30–17:00" (στη γλώσσα του επισκέπτη).
export function slotsSummary(slots, locale = "en-GB") {
  return [...(slots || [])].sort((a, b) => ((Number(a.day) + 6) % 7) - ((Number(b.day) + 6) % 7) || a.from.localeCompare(b.from))
    .map((s) => {
      const name = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 27 + Number(s.day), 12))); // 27/9/2026 = Κυριακή
      return `${name} ${s.from}–${s.to}`;
    }).join(" · ");
}
