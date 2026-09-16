"use client";

import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Έλεγχος πριν την καταχώριση. Κάθε βήμα που γράφει στα βιβλία (έξοδο, παραλαβή) περνάει από εδώ,
// ώστε τίποτα να μη μπαίνει λάθος ή μισό επειδή ξεχάστηκε.
//
//   error → μπλοκάρει· δεν γίνεται καταχώριση όσο υπάρχει
//   warn  → περνάει, αλλά πρέπει να το δεις και να το επιβεβαιώσεις ρητά
//   info  → απλή υπενθύμιση για το τι θα συμβεί μόλις πατήσεις "Καταχώριση"
//
// Χωρίς κανένα εύρημα δεν εμφανίζεται καθόλου — ο καλών προχωράει κατευθείαν.
export function collectChecks(list) {
  return list.filter(Boolean);
}

export function hasBlocker(checks) {
  return checks.some((c) => c.level === "error");
}

// Χρειάζεται επιβεβαίωση μόνο όταν υπάρχει κάτι να δει κανείς.
export function needsReview(checks) {
  return checks.length > 0;
}

const STYLE = {
  error: { box: "bg-red-50 border-red-200 text-red-800", icon: "x", iconColor: "text-red-500" },
  warn: { box: "bg-amber-50 border-amber-200 text-amber-800", icon: "alert", iconColor: "text-amber-500" },
  info: { box: "bg-sky-50 border-sky-200 text-sky-800", icon: "note", iconColor: "text-sky-500" },
};

export default function ReviewDialog({ open, title, checks = [], busy, confirmLabel, onCancel, onConfirm }) {
  const { t } = useLanguage();
  if (!open) return null;

  const blocked = hasBlocker(checks);
  const order = { error: 0, warn: 1, info: 2 };
  const sorted = [...checks].sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]" onClick={() => !busy && onCancel()}>
      <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">{title || t("review.title")}</h2>
        <p className="text-sm text-slate-500 mb-4">{blocked ? t("review.blockedSub") : t("review.sub")}</p>

        <div className="space-y-2">
          {sorted.map((c, i) => {
            const s = STYLE[c.level] || STYLE.info;
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${s.box}`}>
                <Icon name={s.icon} size={15} className={`mt-0.5 shrink-0 ${s.iconColor}`} />
                <span>{c.text}</span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="btn-secondary">{blocked ? t("review.goBack") : t("common.cancel")}</button>
          {!blocked && (
            <button onClick={onConfirm} disabled={busy} className="btn-primary">
              {busy ? t("common.saving") : confirmLabel || t("review.confirmAnyway")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
