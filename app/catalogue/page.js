"use client";

import { useEffect, useMemo, useState } from "react";
import CatalogueGrid from "@/components/CatalogueGrid";
import { perfumeDisplay } from "@/lib/catalogue";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BRAND_NAME = "DUBAI AROMAS CYPRUS";

// Δημόσιος κατάλογος αρωμάτων: ο καθένας με τον σύνδεσμο βλέπει φωτογραφίες + προτεινόμενη τιμή πώλησης
// στο κατάστημα και μπορεί να στείλει παραγγελία (όνομα + τηλέφωνο). Η παραγγελία μπαίνει στις Παραγγελίες.
export default function CataloguePage() {
  const { t, lang, setLanguage } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [cart, setCart] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", website: "" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    fetch("/api/catalogue").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setError(true));
  }, []);

  const setQty = (id, v) => setCart((c) => {
    const n = { ...c };
    const q = Math.max(0, Math.min(99, Math.floor(Number(v) || 0)));
    if (q === 0) delete n[id]; else n[id] = q;
    return n;
  });

  const cur = data?.company?.currency || "€";
  const lines = useMemo(() => (data ? Object.entries(cart).map(([id, quantity]) => ({ p: data.products.find((x) => x.id === id), quantity })).filter((l) => l.p) : []), [cart, data]);
  const count = lines.reduce((a, l) => a + l.quantity, 0);

  const send = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 6) { setMsg(t("catalogue.errRequired")); return; }
    setSending(true);
    try {
      const res = await fetch("/api/catalogue/order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity })) }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setDone(j.number); setCart({}); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setMsg(t(j.error || "catalogue.error"));
    } catch { setMsg(t("catalogue.error")); }
    setSending(false);
  };

  const langToggle = (
    <div className="lux-lang no-print">
      <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
      <button type="button" className={lang === "el" ? "active" : ""} onClick={() => setLanguage("el")}>ΕΛ</button>
    </div>
  );

  if (error) return <div className="lux flex items-center justify-center p-6 text-center lux-meta">{t("catalogue.error")}</div>;
  if (!data) return <div className="lux flex items-center justify-center lux-meta" style={{ letterSpacing: "0.3em" }}>{BRAND_NAME}</div>;

  return (
    <div className="lux catalogue-page pb-28 print:pb-0">
      <header className="max-w-6xl mx-auto px-5 sm:px-8 pt-6">
        <div className="flex items-center justify-between no-print">
          {langToggle}
          <button type="button" onClick={() => window.print()} className="lux-btn-ghost">{t("catalogue.print")}</button>
        </div>
        <div className="text-center pt-10 pb-8">
          <div className="lux-eyebrow">{t("catalogue.subtitle")}</div>
          <h1 className="lux-serif lux-gold-text mt-4 font-medium" style={{ fontSize: "clamp(1.9rem, 6.2vw, 3.4rem)", letterSpacing: "0.16em", lineHeight: 1.1 }}>{BRAND_NAME}</h1>
          <div className="lux-rule mx-auto mt-7" style={{ maxWidth: 220 }} />
          <div className="lux-serif mt-6" style={{ fontSize: "1.5rem", color: "#f2ece0", fontWeight: 400, letterSpacing: "0.06em" }}>{t("catalogue.title")}</div>
          <p className="mt-3 mx-auto lux-meta" style={{ maxWidth: 460, fontSize: "0.82rem", lineHeight: 1.7 }}>{t("catalogue.intro")}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 space-y-8">
        {done && (
          <div className="lux-notice flex items-start justify-between gap-4">
            <span>{t("catalogue.sent", { number: done })}</span>
            <button type="button" className="lux-link" onClick={() => setDone(null)} aria-label="close">×</button>
          </div>
        )}

        <CatalogueGrid variant="lux" products={data.products} cart={cart} setQty={setQty} cur={cur} t={t} />

        <div className="lux-rule" />
        <footer className="text-center pb-6 space-y-2">
          <div className="lux-serif lux-gold-text" style={{ fontSize: "1.05rem", letterSpacing: "0.22em" }}>{BRAND_NAME}</div>
          {(data.company.phone || data.company.email) && (
            <div className="lux-meta">{[data.company.phone, data.company.email].filter(Boolean).join("  ·  ")}</div>
          )}
          <p className="lux-meta mx-auto" style={{ maxWidth: 520, fontSize: "0.66rem", lineHeight: 1.7 }}>{t("catalogue.footnote")}</p>
        </footer>
      </main>

      {count > 0 && !showForm && (
        <div className="lux-bar no-print">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-3">
            <div style={{ fontSize: "0.8rem", letterSpacing: "0.08em" }}>
              <span className="lux-serif" style={{ fontSize: "1.25rem", color: "#e2c887" }}>{t("catalogue.items", { count })}</span>
              <span className="lux-meta">  ·  {t("catalogue.yourOrder")}</span>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" className="lux-link" onClick={() => setCart({})}>{t("catalogue.clear")}</button>
              <button type="button" className="lux-btn" onClick={() => { setMsg(""); setShowForm(true); }}>{t("catalogue.continue")}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="lux-overlay no-print" onClick={() => setShowForm(false)}>
          <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="lux-modal space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="lux-eyebrow">{BRAND_NAME}</div>
                <h2 className="lux-serif mt-1" style={{ fontSize: "1.7rem", color: "#f7f1e3", fontWeight: 500 }}>{t("catalogue.yourOrder")}</h2>
              </div>
              <button type="button" className="lux-link" style={{ fontSize: "1.4rem", lineHeight: 1 }} onClick={() => setShowForm(false)} aria-label="close">×</button>
            </div>
            <div className="lux-rule" />
            <div style={{ maxHeight: 190, overflowY: "auto" }}>
              {lines.map((l) => (
                <div key={l.p.id} className="flex items-center justify-between gap-4 py-2" style={{ borderBottom: "1px solid rgba(200,165,90,0.15)", fontSize: "0.85rem" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="lux-brand" style={{ display: "block", fontSize: "0.55rem" }}>{String(l.p.brand || "").toUpperCase()}</span>
                    <span className="lux-serif" style={{ fontSize: "1.1rem", color: "#f7f1e3" }}>{perfumeDisplay(l.p).title}</span>
                  </span>
                  <span className="lux-serif" style={{ color: "#e2c887", fontSize: "1.15rem", flexShrink: 0, whiteSpace: "nowrap" }}>× {l.quantity}</span>
                </div>
              ))}
            </div>
            <div><label className="lux-label">{t("catalogue.name")} *</label><input className="lux-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div><label className="lux-label">{t("catalogue.phone")} *</label><input className="lux-input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" required /></div>
              <div><label className="lux-label">{t("catalogue.email")}</label><input className="lux-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></div>
            </div>
            <div><label className="lux-label">{t("catalogue.notes")}</label><textarea className="lux-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {/* Παγίδα για ρομπότ: αόρατο πεδίο που ένας άνθρωπος δεν συμπληρώνει ποτέ. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
            {msg && <div className="lux-error">{msg}</div>}
            <p className="lux-meta" style={{ fontSize: "0.68rem", lineHeight: 1.6 }}>{t("catalogue.orderNote")}</p>
            <button type="submit" disabled={sending} className="lux-btn w-full">{sending ? t("common.loading") : t("catalogue.sendOrder")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
