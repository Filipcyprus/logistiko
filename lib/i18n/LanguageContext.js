"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations, LOCALE_MAP } from "@/lib/i18n/translations";
import { setFormatLocale } from "@/lib/format";

const STORAGE_KEY = "logistiko.language";
const DEFAULT_LANG = "en";

const LanguageContext = createContext(null);

function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{{${k}}}`));
}

export function LanguageProvider({ children }) {
  // Αρχική τιμή από localStorage ώστε να μην τρεμοπαίζει η γλώσσα στη φόρτωση.
  const [lang, setLangState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LANG;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  });
  const [ready, setReady] = useState(false);

  // Ενημέρωση του <html lang> για προσβασιμότητα/SEO.
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  // Συγχρονισμός με το προφίλ (Ρυθμίσεις) — πηγή αλήθειας μεταξύ επανεκκινήσεων.
  useEffect(() => {
    setFormatLocale(LOCALE_MAP[lang] || LOCALE_MAP[DEFAULT_LANG]);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.language && s.language !== lang) {
          setLangState(s.language);
          localStorage.setItem(STORAGE_KEY, s.language);
          setFormatLocale(LOCALE_MAP[s.language] || LOCALE_MAP[DEFAULT_LANG]);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((newLang) => {
    if (!translations[newLang]) return;
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    setFormatLocale(LOCALE_MAP[newLang] || LOCALE_MAP[DEFAULT_LANG]);
    // Αποθήκευση στο προφίλ επιχείρησης (persist), χωρίς να μπλοκάρει το UI.
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: newLang }),
    }).catch(() => {});
  }, []);

  const t = useCallback(
    (key, vars) => {
      if (!key || typeof key !== "string") return "";
      const dict = translations[lang] || translations[DEFAULT_LANG];
      let val = getNested(dict, key);
      if (val === undefined) val = getNested(translations[DEFAULT_LANG], key);
      if (val === undefined) return key;
      if (Array.isArray(val)) return val;
      return interpolate(val, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLanguage, t, ready }), [lang, setLanguage, t, ready]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
