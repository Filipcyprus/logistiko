"use client";

import { useEffect, useRef, useState } from "react";
import { productMatchesQuery } from "@/lib/productSearch";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Πεδίο αναζήτησης προϊόντος: γράφεις και φιλτράρει αντί να κάνεις scroll σε ένα μεγάλο <select> —
// ίδια λογική αναζήτησης (όνομα/κωδικός/SKU/barcode) με το Ταμείο και τις γραμμές παραστατικών.
// Για απλές φόρμες "προϊόν + ποσότητα" (π.χ. αποστολή αποθέματος παρακαταθήκης), όχι για πίνακες
// γραμμών με τιμές/ΦΠΑ — εκεί χρησιμοποιείται το LineItems.
export default function ProductPicker({ value, onChange, products, placeholder, formatOption, className = "" }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = products.find((p) => p.id === value) || null;
  const label = (p) => (formatOption ? formatOption(p) : p.name);

  useEffect(() => {
    const onDocPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  const matches = open ? products.filter((p) => productMatchesQuery(p, query)).slice(0, 50) : [];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <input
        className="input"
        value={open ? query : selected ? label(selected) : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        placeholder={placeholder || t("common.searchToFind")}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">{t("common.noProductMatches")}</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                {label(p)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
