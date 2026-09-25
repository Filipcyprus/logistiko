"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { perfumeDisplay } from "@/lib/catalogue";

// Κατάλογος αρωμάτων με φωτογραφίες, αναζήτηση, φίλτρο μάρκας/φύλου και επιλογή ποσότητας.
// Το καλάθι το κρατάει η σελίδα που τον χρησιμοποιεί (δημόσιος κατάλογος ή portal παρακαταθήκης):
//   cart: { [productId]: quantity }      setQty(productId, quantity)
//   testers / setTester: μόνο για το portal καταστημάτων (αίτημα δείγματος)
//   variant: "lux" = μαύρο & χρυσό (δημόσιος κατάλογος DUBAI AROMAS CYPRUS) · "default" = το στυλ της εφαρμογής (portal)
export default function CatalogueGrid({ products, cart, setQty, cur = "€", t, testers, setTester, variant = "default", lang = "en" }) {
  const lux = variant === "lux";
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [gender, setGender] = useState("");
  const [openDesc, setOpenDesc] = useState({}); // productId -> true όταν η περιγραφή είναι ανοιχτή

  // Η μάρκα κανονικοποιείται σε κεφαλαία ("Fariis" και "FARIIS" είναι η ίδια μάρκα).
  const items = useMemo(() => products.map((p) => ({ ...p, brand: String(p.brand || "").toUpperCase(), info: perfumeDisplay(p) })), [products]);
  const brands = useMemo(() => Array.from(new Set(items.map((p) => p.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [items]);
  const genders = useMemo(() => ["Men", "Women", "Unisex"].filter((g) => items.some((p) => p.info.gender === g)), [items]);

  const shown = items.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (gender && p.info.gender !== gender) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.brand || "").toLowerCase().includes(s);
  });

  const chip = (active) => `px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"}`;
  const genderLabel = (g) => t(`catalogue.gender${g}`);
  const searchKey = (e) => { if (e.key === "Enter") e.preventDefault(); };

  const Filters = lux ? (
    <div className="no-print space-y-5">
      <input className="lux-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={searchKey} placeholder={t("catalogue.search")} />
      <div className="lux-tabs">
        <button type="button" className={`lux-tab ${!brand ? "active" : ""}`} onClick={() => setBrand("")}>{t("catalogue.allBrands")}</button>
        {brands.map((b) => <button type="button" key={b} className={`lux-tab ${brand === b ? "active" : ""}`} onClick={() => setBrand(brand === b ? "" : b)}>{b}</button>)}
      </div>
      {genders.length > 1 && (
        <div className="lux-tabs">
          <button type="button" className={`lux-tab ${!gender ? "active" : ""}`} onClick={() => setGender("")}>{t("catalogue.allGenders")}</button>
          {genders.map((g) => <button type="button" key={g} className={`lux-tab ${gender === g ? "active" : ""}`} onClick={() => setGender(gender === g ? "" : g)}>{genderLabel(g)}</button>)}
        </div>
      )}
    </div>
  ) : (
    <div className="no-print space-y-3">
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={searchKey} placeholder={t("catalogue.search")} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button type="button" className={chip(!brand)} onClick={() => setBrand("")}>{t("catalogue.allBrands")}</button>
        {brands.map((b) => <button type="button" key={b} className={chip(brand === b)} onClick={() => setBrand(brand === b ? "" : b)}>{b}</button>)}
      </div>
      {genders.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button type="button" className={chip(!gender)} onClick={() => setGender("")}>{t("catalogue.allGenders")}</button>
          {genders.map((g) => <button type="button" key={g} className={chip(gender === g)} onClick={() => setGender(gender === g ? "" : g)}>{genderLabel(g)}</button>)}
        </div>
      )}
    </div>
  );

  const renderQty = (p, qty) => lux ? (
    <div className="lux-qty no-print">
      <button type="button" disabled={qty === 0} onClick={() => setQty(p.id, qty - 1)} aria-label="-">−</button>
      <input type="number" min="0" max="99" inputMode="numeric" value={qty || ""} placeholder="0" onChange={(e) => setQty(p.id, Math.min(99, Number(e.target.value) || 0))} />
      <button type="button" onClick={() => setQty(p.id, qty + 1)} aria-label="+">+</button>
    </div>
  ) : (
    <div className="no-print flex items-center justify-between gap-2 pt-1">
      <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
        <button type="button" className="w-9 h-9 text-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30" disabled={qty === 0} onClick={() => setQty(p.id, qty - 1)} aria-label="-">−</button>
        <input type="number" min="0" max="99" inputMode="numeric" className="w-10 h-9 text-center text-sm outline-none" value={qty || ""} placeholder="0" onChange={(e) => setQty(p.id, Math.min(99, Number(e.target.value) || 0))} />
        <button type="button" className="w-9 h-9 text-lg text-slate-600 hover:bg-slate-50" onClick={() => setQty(p.id, qty + 1)} aria-label="+">+</button>
      </div>
    </div>
  );

  return (
    <div className={lux ? "space-y-8" : "space-y-4"}>
      {Filters}

      {shown.length === 0 ? (
        <p className={`text-center py-10 ${lux ? "lux-meta" : "text-slate-400"}`}>{t("catalogue.empty")}</p>
      ) : (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 catalogue-grid ${lux ? "gap-4 sm:gap-6" : "gap-3 sm:gap-4"}`}>
          {shown.map((p) => {
            const qty = cart[p.id] || 0;
            const hasPrice = Number(p.retailPrice) > 0;
            const details = [p.info.concentration, p.info.sizeMl ? `${p.info.sizeMl} ml` : "", p.info.gender ? genderLabel(p.info.gender) : ""].filter(Boolean).join(" · ");

            if (lux) {
              return (
                <div key={p.id} className={`lux-card catalogue-card ${qty > 0 ? "selected" : ""}`}>
                  <div className="lux-img">
                    {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span className="lux-brand">{p.brand}</span>}
                  </div>
                  <div className="lux-body">
                    <div className="lux-brand">{p.brand}</div>
                    <div className="lux-name">{p.info.title}</div>
                    <div className="lux-meta">{details}</div>
                    {(() => {
                      const text = lang === "el" ? (p.descriptionEl || p.description) : (p.description || p.descriptionEl);
                      if (!text) return null;
                      const long = text.length > 120;
                      const open = !!openDesc[p.id];
                      return (
                        <div>
                          <p className={`lux-desc ${open ? "open" : ""}`}>{text}</p>
                          {long && <button type="button" className="lux-more no-print" onClick={() => setOpenDesc((o) => ({ ...o, [p.id]: !o[p.id] }))}>{open ? t("catalogue.less") : t("catalogue.more")}</button>}
                        </div>
                      );
                    })()}
                    <div className="lux-foot">
                    {hasPrice ? (
                      <>
                        <div className="lux-price-label">{t("catalogue.recommended")}</div>
                        <div className="lux-price">{money(p.retailPrice, cur)}</div>
                      </>
                    ) : <div className="lux-price-label">{t("catalogue.priceOnRequest")}</div>}
                    {p.inStock !== undefined && <div className={`lux-avail ${p.inStock ? "in" : "by"}`}>{p.inStock ? t("catalogue.inStock") : t("catalogue.byOrder")}</div>}
                    {renderQty(p, qty)}
                    {setTester && qty > 0 && (
                      <label className="no-print flex items-center gap-1.5 lux-meta">
                        <input type="checkbox" checked={!!(testers && testers[p.id])} onChange={(e) => setTester(p.id, e.target.checked)} />
                        {t("catalogue.requestTester")}
                      </label>
                    )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={p.id} className={`card overflow-hidden flex flex-col catalogue-card ${qty > 0 ? "ring-2 ring-brand-500" : ""}`}>
                <div className="aspect-[4/5] bg-white flex items-center justify-center p-2">
                  {p.image ? <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain" /> : <div className="text-slate-300 text-xs">{p.brand}</div>}
                </div>
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <div className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">{p.brand}</div>
                  <div className="font-semibold text-slate-800 leading-snug">{p.info.title}</div>
                  <div className="text-xs text-slate-500">{details}</div>
                  <div className="mt-auto pt-1">
                    {hasPrice ? (
                      <>
                        <div className="text-[11px] text-slate-500">{t("catalogue.recommended")}</div>
                        <div className="text-lg font-bold text-slate-900">{money(p.retailPrice, cur)}</div>
                      </>
                    ) : <div className="text-sm text-slate-400">{t("catalogue.priceOnRequest")}</div>}
                    {p.inStock !== undefined && (
                      <div className={`text-[11px] mt-0.5 ${p.inStock ? "text-emerald-600" : "text-amber-600"}`}>{p.inStock ? t("catalogue.inStock") : t("catalogue.byOrder")}</div>
                    )}
                  </div>
                  {renderQty(p, qty)}
                  {setTester && qty > 0 && (
                    <label className="no-print flex items-center gap-1.5 text-xs text-slate-500">
                      <input type="checkbox" checked={!!(testers && testers[p.id])} onChange={(e) => setTester(p.id, e.target.checked)} />
                      {t("catalogue.requestTester")}
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
