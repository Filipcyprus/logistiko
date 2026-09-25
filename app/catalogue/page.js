"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CatalogueGrid from "@/components/CatalogueGrid";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Δημόσιος κατάλογος αρωμάτων: ο καθένας με τον σύνδεσμο βλέπει φωτογραφίες + προτεινόμενη τιμή πώλησης
// στο κατάστημα και μπορεί να στείλει παραγγελία (όνομα + τηλέφωνο). Η παραγγελία μπαίνει στις Παραγγελίες.
export default function CataloguePage() {
  const { t } = useLanguage();
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
      if (res.ok) { setDone(j.number); setCart({}); setShowForm(false); }
      else setMsg(t(j.error || "catalogue.error"));
    } catch { setMsg(t("catalogue.error")); }
    setSending(false);
  };

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-slate-500">{t("catalogue.error")}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="catalogue-page min-h-screen bg-slate-50 pb-28 print:pb-0 print:bg-white">
      <header className="bg-brand-700 text-white print:bg-white print:text-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {data.company.logo && <img src={data.company.logo} alt="" className="h-10 w-10 rounded object-contain bg-white p-0.5" />}
            <div className="min-w-0">
              <div className="font-bold leading-tight truncate">{data.company.name}</div>
              <div className="text-xs text-brand-100 print:text-slate-500">{t("catalogue.subtitle")}</div>
            </div>
          </div>
          <div className="no-print flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => window.print()} className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold border border-white/40 rounded-md px-2.5 py-1.5 hover:bg-white/10">
              <Icon name="printer" size={14} /> {t("catalogue.print")}
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t("catalogue.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("catalogue.intro")}</p>
        </div>

        {done && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm flex items-start justify-between gap-3">
            <span>{t("catalogue.sent", { number: done })}</span>
            <button type="button" className="text-emerald-700 font-bold" onClick={() => setDone(null)} aria-label="close">×</button>
          </div>
        )}

        <CatalogueGrid products={data.products} cart={cart} setQty={setQty} cur={cur} t={t} />

        <p className="text-xs text-slate-400 pt-4">{t("catalogue.footnote")}</p>
        {(data.company.phone || data.company.email) && (
          <p className="text-xs text-slate-500">{[data.company.phone, data.company.email].filter(Boolean).join(" · ")}</p>
        )}
      </main>

      {count > 0 && !showForm && (
        <div className="no-print fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700"><span className="font-bold">{t("catalogue.items", { count })}</span> · {t("catalogue.yourOrder")}</div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setCart({})}>{t("catalogue.clear")}</button>
              <button type="button" className="btn-primary" onClick={() => { setMsg(""); setShowForm(true); }}>{t("catalogue.continue")}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="no-print fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowForm(false)}>
          <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{t("catalogue.yourOrder")}</h2>
              <button type="button" className="text-slate-400 text-2xl leading-none" onClick={() => setShowForm(false)} aria-label="close">×</button>
            </div>
            <div className="divide-y divide-slate-100 text-sm max-h-52 overflow-y-auto border border-slate-100 rounded-lg">
              {lines.map((l) => (
                <div key={l.p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-slate-700 min-w-0 truncate">{l.p.name}</span>
                  <span className="font-semibold text-slate-800 shrink-0">× {l.quantity}</span>
                </div>
              ))}
            </div>
            <div><label className="label">{t("catalogue.name")} *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">{t("catalogue.phone")} *</label><input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" required /></div>
              <div><label className="label">{t("catalogue.email")}</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></div>
            </div>
            <div><label className="label">{t("catalogue.notes")}</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {/* Παγίδα για ρομπότ: αόρατο πεδίο που ένας άνθρωπος δεν συμπληρώνει ποτέ. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
            {msg && <div className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700">{msg}</div>}
            <p className="text-xs text-slate-400">{t("catalogue.orderNote")}</p>
            <button type="submit" disabled={sending} className="btn-primary w-full justify-center">{sending ? t("common.loading") : t("catalogue.sendOrder")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
