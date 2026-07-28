"use client";

import { useEffect, useState } from "react";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import PortalLogin from "@/components/PortalLogin";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ConsignmentPortalPage() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [errorCode, setErrorCode] = useState("");
  const [tab, setTab] = useState("stock");

  const [saleProductId, setSaleProductId] = useState("");
  const [saleQty, setSaleQty] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleMsg, setSaleMsg] = useState("");
  const [saleSubmitting, setSaleSubmitting] = useState(false);

  const [orderLines, setOrderLines] = useState({}); // productId -> qty
  const [orderNotes, setOrderNotes] = useState("");
  const [orderMsg, setOrderMsg] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const load = () =>
    fetch("/api/consignment-portal")
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then((d) => { setErrorCode(""); setData(d); })
      .catch((e) => setErrorCode(e.error || "common.error"));

  useEffect(() => { load(); }, []);

  const cur = data?.company?.currency || "€";

  const submitSale = async (e) => {
    e.preventDefault();
    setSaleMsg("");
    const qty = Number(saleQty);
    const price = Number(salePrice);
    if (!saleProductId || qty <= 0) return;
    setSaleSubmitting(true);
    const res = await fetch("/api/consignment-portal/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: saleProductId, quantity: qty, unitPrice: price }),
    });
    setSaleSubmitting(false);
    if (res.ok) {
      setSaleMsg(t("consignmentPortal.sellSuccess"));
      setSaleProductId(""); setSaleQty(""); setSalePrice("");
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      setSaleMsg(err.error === "errors.insufficientStock" ? t("consignmentPortal.errInsufficientStock") : t("common.error"));
    }
  };

  const setOrderQty = (productId, qty) => setOrderLines((prev) => {
    const n = { ...prev };
    const v = Math.max(0, Number(qty) || 0);
    if (v === 0) delete n[productId];
    else n[productId] = { ...(n[productId] || { isTester: false }), quantity: v };
    return n;
  });
  const setOrderTester = (productId, isTester) => setOrderLines((prev) => (
    prev[productId] ? { ...prev, [productId]: { ...prev[productId], isTester } } : prev
  ));

  const submitOrder = async (e) => {
    e.preventDefault();
    setOrderMsg("");
    const items = Object.entries(orderLines).map(([productId, line]) => ({ productId, quantity: line.quantity, isTester: !!line.isTester }));
    if (items.length === 0) return;
    setOrderSubmitting(true);
    const res = await fetch("/api/consignment-portal/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, notes: orderNotes }),
    });
    setOrderSubmitting(false);
    if (res.ok) {
      setOrderMsg(t("consignmentPortal.orderSuccess"));
      setOrderLines({}); setOrderNotes("");
      load();
    } else {
      setOrderMsg(t("common.error"));
    }
  };

  if (errorCode === "errors.loginRequired") {
    return <PortalLogin subtitle={t("portalLogin.subtitleConsignment")} onSuccess={load} />;
  }
  if (errorCode) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 text-center max-w-md">
        <Icon name="lock" size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">{t(errorCode)}</p>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-400">{t("common.loading")}</div>;

  const stockProducts = data.products.filter((p) => p.myStock > 0);
  const orderableProducts = data.products;

  const TABS = [
    ["stock", t("consignmentPortal.tabStock")],
    ["sell", t("consignmentPortal.tabSell")],
    ["order", t("consignmentPortal.tabOrder")],
    ["history", t("consignmentPortal.tabHistory")],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold leading-tight">{data.company.name}</div>
            <div className="text-xs text-brand-100">{t("consignmentPortal.tagline", { store: data.store.name })}</div>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === key ? "border-white text-white" : "border-transparent text-brand-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {tab === "stock" && (
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">{t("consignmentPortal.myStockTitle")}</h2>
            {stockProducts.length === 0 ? (
              <p className="text-sm text-slate-400">{t("consignmentPortal.noStock")}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {stockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p.image ? <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0"><img src={p.image} alt="" className="w-full h-full object-contain" /></div> : <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Icon name="image" size={16} /></div>}
                      <div className="font-medium text-slate-700 truncate">{p.name}</div>
                    </div>
                    <div className="text-slate-500 shrink-0">{p.myStock} {p.unit}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "sell" && (
          <form onSubmit={submitSale} className="card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">{t("consignmentPortal.sellTitle")}</h2>
            {saleMsg && <div className="text-sm rounded-lg px-3 py-2 bg-brand-50 text-brand-700">{saleMsg}</div>}
            <div>
              <label className="label">{t("consignmentPortal.sellProduct")}</label>
              <div className="flex items-center gap-2.5">
                {saleProductId && (() => {
                  const p = stockProducts.find((x) => x.id === saleProductId);
                  return p?.image ? <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0"><img src={p.image} alt="" className="w-full h-full object-contain" /></div> : null;
                })()}
                <select className="input" value={saleProductId} onChange={(e) => setSaleProductId(e.target.value)}>
                  <option value="">{t("consignmentPortal.selectProduct")}</option>
                  {stockProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.myStock} {p.unit})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("consignmentPortal.sellQuantity")}</label>
                <input type="number" min="0" step="any" className="input" value={saleQty} onChange={(e) => setSaleQty(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("consignmentPortal.sellPrice")} ({cur})</label>
                <input type="number" min="0" step="any" className="input" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={saleSubmitting} className="btn-primary w-full justify-center">
              {t("consignmentPortal.sellSubmit")}
            </button>
          </form>
        )}

        {tab === "order" && (
          <form onSubmit={submitOrder} className="card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">{t("consignmentPortal.orderTitle")}</h2>
            {orderMsg && <div className="text-sm rounded-lg px-3 py-2 bg-brand-50 text-brand-700">{orderMsg}</div>}
            <div className="divide-y divide-slate-100">
              {orderableProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.image ? <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0"><img src={p.image} alt="" className="w-full h-full object-contain" /></div> : <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Icon name="image" size={16} /></div>}
                    <div className="text-sm font-medium text-slate-700 truncate">{p.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {orderLines[p.id]?.quantity > 0 && (
                      <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                        <input type="checkbox" checked={!!orderLines[p.id]?.isTester} onChange={(e) => setOrderTester(p.id, e.target.checked)} />
                        {t("consignmentPortal.requestTester")}
                      </label>
                    )}
                    <input
                      type="number" min="0" step="any"
                      className="input w-20 text-right"
                      value={orderLines[p.id]?.quantity || ""}
                      onChange={(e) => setOrderQty(p.id, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="label">{t("consignmentPortal.orderNotes")}</label>
              <textarea className="input" rows={2} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            </div>
            <button type="submit" disabled={orderSubmitting} className="btn-primary w-full justify-center">
              {t("consignmentPortal.orderSubmit")}
            </button>
          </form>
        )}

        {tab === "history" && (
          <>
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-slate-800">{t("consignmentPortal.recentSales")}</h2>
              {data.recentSales.length === 0 ? (
                <p className="text-sm text-slate-400">{t("consignmentPortal.noSales")}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div className="font-medium text-slate-700">{s.productName}</div>
                        <div className="text-xs text-slate-400">{formatDate(s.date)} · {s.quantity} × {money(s.unitPrice, cur)}</div>
                      </div>
                      <div className="font-semibold text-slate-700">{money(s.total, cur)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-slate-800">{t("consignmentPortal.recentOrders")}</h2>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-slate-400">{t("consignmentPortal.noOrders")}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentOrders.map((o) => (
                    <div key={o.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-400">{formatDate(o.createdAt)}</div>
                        <span className={`badge ${o.status === "fulfilled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {o.status === "fulfilled" ? t("consignmentPortal.orderStatusFulfilled") : t("consignmentPortal.orderStatusPending")}
                        </span>
                      </div>
                      <div className="text-slate-600 mt-1">
                        {o.items.map((it) => `${it.productName} × ${it.quantity}${it.isTester ? ` (${t("consignmentPortal.tester")})` : ""}`).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
