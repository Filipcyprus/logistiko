"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

// Μικρός εναλλάκτης γλώσσας EN/ΕΛ — άμεση αλλαγή, χωρίς reload.
export default function LanguageSwitcher({ className = "", variant = "dark" }) {
  const { lang, setLanguage } = useLanguage();
  const isDark = variant === "dark";

  const border = isDark ? "border-slate-700" : "border-slate-300";
  const inactive = isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100";

  return (
    <div className={`inline-flex rounded-md border overflow-hidden text-xs font-semibold ${border} ${className}`}>
      <button
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1.5 transition-colors ${lang === "en" ? "bg-brand-600 text-white" : inactive}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("el")}
        className={`px-2.5 py-1.5 transition-colors border-l ${border} ${lang === "el" ? "bg-brand-600 text-white" : inactive}`}
        aria-pressed={lang === "el"}
      >
        ΕΛ
      </button>
    </div>
  );
}
