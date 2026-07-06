"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { money, computeTotals, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function PortalPage() {
  const { token } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState({}); // productId -> qty
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // {number}

  const load = () => fetch(`/api/portal/${token}`).then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))).then(setData).catch((e) => setError(e.error ? t(e.error) : t("common.error")));
  useEffect(() => { load(); }, [token]);

  const cur = data?.company?.currency || "€";
  const disc = data?.customer?.defaultDiscount || 0;

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (!q) return true;
      const query = q.toLowerCase();
      return p.name.toLowerCase().includes(query) || (p.code || "").toLowerCase().includes(query);
    });
  }, [data, q, cat]);

  const setQty = (id, v) => setCart((c) => { const n = { ...c }; const qty = Math.max(0, Number(v) || 0); if (qty === 0) delete n[id]; else n[id] = qty; return n; });

  const cartLines = useMemo(() => {
    if (!data) return [];
    return Object.entries(cart).map(([id, qty]) => {
      const p = data.products.find((x) => x.id === id);
      return { productId: id, description: p.name, image: p.image, quantity: qty, unit: p.unit, unitPrice: p.finalPrice, vatRate: p.vatRate, discount: 0 };
    });
  }, [cart, data]);

  const totals = computeTotals(cartLines);

  const statusLabel = (status) => {
    if (status === "invoiced") return t("portal.statusInvoiced");
    if (status === "delivered") return t("portal.statusDelivered");
    if (status === "ready") return t("portal.statusReady");
    if (status === "in_progress") return t("portal.statusInProgress");
    return t("portal.statusReceived");
  };

  const submit = async () => {
    if (cartLines.length === 0) { alert(t("portal.errCartEmpty")); return; }
    if (data.customer.requirePin && !pin) { alert(t("portal.errNeedPin")); return; }
    setSubmitting(true);
    const res = await fetch(`/api/portal/${token}/order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, items: cartLines, notes, deliveryDate }) });
    if (res.ok) { const r = await res.json(); setDone(r); setCart({}); setNotes(""); setDeliveryDate(""); setPin(""); load(); }
    else { const e = await res.json(); alert(e.error ? t(e.error) : t("portal.errSubmit")); }
    setSubmitting(false);
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 text-center max-w-md">
        <Icon name="lock" size={32} className="mx-auto mb-3 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">{t("portal.unavailableTitle")}</h1>
        <p className="text-slate-500">{error}</p>
        <div className="mt-4 flex justify-center"><LanguageSwitcher variant="light" /></div>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-brand-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {data.company.logo ? <img src={data.company.logo} alt="" className="h-10 bg-white rounded p-1" /> : <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center"><Icon name="invoice" size={18} /></div>}
            <div>
              <div className="font-bold leading-tight">{data.company.name}</div>
              <div className="text-xs text-brand-100">{t("portal.b2bTagline")}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="font-semibold">{data.customer.name}</div>
              {data.customer.priceListName && <div className="text-brand-100 text-xs">{t("customers.fieldPriceList")}: {data.customer.priceListName}{disc && !data.customer.hasCustomPrices ? ` (−${disc}%)` : ""}</div>}
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Κατάλογος */}
        <div className="lg:col-span-2 space-y-4">
          {done && (
            <div className="card p-5 bg-emerald-50 border-emerald-200">
              <div className="font-semibold text-emerald-800 flex items-center gap-1.5"><Icon name="check" size={16} /> {t("portal.orderSuccess")}</div>
              <div className="text-sm text-emerald-700">{t("portal.orderSuccessSub", { number: done.number })}</div>
              <button onClick={() => setDone(null)} className="btn-secondary mt-3">{t("portal.newOrder")}</button>
            </div>
          )}

          <div className="card p-4 flex flex-wrap gap-3">
            <div className="relative max-w-xs w-full">
              <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder={t("portal.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {data.categories.length > 0 && (
              <select className="input max-w-[220px]" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">{t("portal.allCategories")}</option>
                {data.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.length === 0 ? <p className="text-slate-400 text-sm">{t("portal.noProducts")}</p> : filtered.map((p) => {
              const net = p.finalPrice;
              const inCart = cart[p.id] || 0;
              const out = p.trackStock !== false && Number(p.stock) <= 0;
              return (
                <div key={p.id} className="card p-3 flex gap-3">
                  {p.image ? <img src={p.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" /> : <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Icon name="image" size={20} /></div>}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                      {p.category && <div className="text-xs text-slate-400">{p.category}</div>}
                      <div className="mt-1 text-base font-bold text-brand-700">{money(net, cur)} <span className="text-xs font-normal text-slate-400">{t("portal.perUnitExclVat", { unit: p.unit })}</span></div>
                      {!p.hasCustomPrice && disc > 0 && <div className="text-xs text-slate-400 line-through">{money(p.price, cur)}</div>}
                      {p.trackStock !== false && <div className={`text-xs mt-0.5 ${out ? "text-red-500" : "text-emerald-600"}`}>{out ? t("portal.outOfStock") : t("portal.available", { stock: p.stock, unit: p.unit })}</div>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" min="0" step="any" className="input !py-1 w-16" value={inCart} onChange={(e) => setQty(p.id, e.target.value)} />
                      <button onClick={() => setQty(p.id, inCart + 1)} className="btn-primary !py-1 flex-1"><Icon name="plus" size={14} /> {t("portal.addToCart")}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ιστορικό παραγγελιών */}
          {data.orders.length > 0 && (
            <div className="card overflow-hidden mt-6">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">{t("portal.myOrders")}</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-2 font-medium">{o.number}</td>
                      <td className="px-4 py-2 text-slate-500">{formatDate(o.date)}</td>
                      <td className="px-4 py-2 text-right">{money(o.total, cur)}</td>
                      <td className="px-4 py-2 text-slate-500">{statusLabel(o.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Καλάθι */}
        <div>
          <div className="card p-5 sticky top-4">
            <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Icon name="cart" size={18} /> {t("portal.cart")} ({cartLines.length})</h2>
            {cartLines.length === 0 ? <p className="text-sm text-slate-400">{t("portal.cartEmpty")}</p> : (
              <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                {cartLines.map((l) => (
                  <div key={l.productId} className="flex justify-between items-center text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {l.image ? <img src={l.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" /> : <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Icon name="image" size={12} /></div>}
                      <div className="min-w-0"><div className="truncate">{l.description}</div><div className="text-xs text-slate-400">{l.quantity} × {money(l.unitPrice, cur)}</div></div>
                    </div>
                    <button onClick={() => setQty(l.productId, 0)} className="text-red-500 shrink-0"><Icon name="x" size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1 text-sm border-t border-slate-100 pt-3">
              <div className="flex justify-between text-slate-500"><span>{t("portal.net")}</span><span>{money(totals.net, cur)}</span></div>
              <div className="flex justify-between text-slate-500"><span>{t("portal.vat")}</span><span>{money(totals.vat, cur)}</span></div>
              <div className="flex justify-between font-bold text-slate-800 text-base"><span>{t("portal.total")}</span><span>{money(totals.total, cur)}</span></div>
            </div>
            <div className="space-y-3 mt-4">
              <div><label className="label">{t("portal.desiredDelivery")}</label><input type="date" className="input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
              <div><label className="label">{t("portal.comments")}</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("portal.commentsPlaceholder")} /></div>
              {data.customer.requirePin && <div><label className="label">{t("portal.accessPin")}</label><input className="input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t("portal.pinPlaceholder")} /></div>}
              <button onClick={submit} disabled={submitting || cartLines.length === 0} className="btn-primary w-full">{submitting ? t("portal.submitting") : t("portal.submitOrder")}</button>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 py-6">{data.company.name} · {[data.company.phone, data.company.email].filter(Boolean).join(" · ")}</footer>
    </div>
  );
}
