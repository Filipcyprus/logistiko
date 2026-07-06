// Σταθερές για τις εργασίες παραγωγής.

export function getPriorities(t) {
  return {
    low: { label: t("jobs.priorities.low"), color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    normal: { label: t("jobs.priorities.normal"), color: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
    high: { label: t("jobs.priorities.high"), color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    urgent: { label: t("jobs.priorities.urgent"), color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  };
}

// Χρώματα σταδίων (κλάσεις Tailwind για επικεφαλίδα στήλης)
export const STAGE_COLORS = {
  slate: { head: "bg-slate-100 text-slate-700", bar: "bg-slate-400" },
  violet: { head: "bg-violet-100 text-violet-700", bar: "bg-violet-500" },
  blue: { head: "bg-sky-100 text-sky-700", bar: "bg-sky-500" },
  amber: { head: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  emerald: { head: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  rose: { head: "bg-rose-100 text-rose-700", bar: "bg-rose-500" },
  brand: { head: "bg-brand-100 text-brand-700", bar: "bg-brand-500" },
};

export const STAGE_COLOR_OPTIONS = ["slate", "violet", "blue", "amber", "emerald", "rose", "brand"];
