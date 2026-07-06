"use client";

import { useEffect, useRef, useState } from "react";
import { money, computeTotals } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function TillPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [me, setMe] = useState(null);
  const [heldSales, setHeldSales] = useState([]);
  const [showHeld, setShowHeld] = useState(false);
  const searchRef = useRef();

  const load = () => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
  };
  const loadHeld = () => fetch("/api/held-sales").then((r) => (r.ok ? r.json() : [])).then(setHeldSales);

  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).then(setMe);
    loadHeld();
    searchRef.current?.focus();
  }, []);

  const cur = settings?.currency || "€";
  const canDiscount = me ? me.canDiscount : true;
  const q = query.trim().toLowerCase();
  const matches = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q) || (p.barcode || "").includes(q)).slice(0, 8)
    : [];

  const addToCart = (p) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === p.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, price: Number(p.retailPrice ?? p.price ?? 0), vatRate: Number(p.vatRate || 0), qty: 1, discount: 0 }];
    });
    setQuery("");
    setLastSale(null);
    searchRef.current?.focus();
  };

  const onSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const exactBarcode = products.find((p) => p.barcode && p.barcode === query.trim());
    if (exactBarcode) { addToCart(exactBarcode); return; }
    if (matches.length === 1) addToCart(matches[0]);
  };

  const updateLine = (idx, patch) => setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeLine = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const lineItems = cart.map((c) => ({ quantity: c.qty, unitPrice: c.price, vatRate: c.vatRate, discount: c.discount || 0 }));
  const totals = computeTotals(lineItems);
  const change = tendered !== "" ? Math.round((Number(tendered) - totals.total) * 100) / 100 : null;
  const insufficientCash = paymentMethod === "cash" && tendered !== "" && change < 0;

  const holdSale = async () => {
    if (cart.length === 0) { alert(t("pos.errEmptyCart")); return; }
    const label = prompt(t("pos.holdLabelPrompt")) || "";
    await fetch("/api/held-sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, customerId, cart }) });
    setCart([]); setCustomerId(""); setTendered(""); setQuery("");
    loadHeld();
    searchRef.current?.focus();
  };

  const resumeSale = async (h) => {
    if (cart.length > 0 && !confirm(t("pos.confirmReplaceCart"))) return;
    setCart(h.cart || []);
    setCustomerId(h.customerId || "");
    setShowHeld(false);
    await fetch(`/api/held-sales/${h.id}`, { method: "DELETE" });
    loadHeld();
  };

  const discardHeld = async (id) => {
    if (!confirm(t("pos.confirmDiscardHeld"))) return;
    await fetch(`/api/held-sales/${id}`, { method: "DELETE" });
    loadHeld();
  };

  const completeSale = async () => {
    if (cart.length === 0) { alert(t("pos.errEmptyCart")); return; }
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "apodeixi",
        customerId: customerId || null,
        paymentMethod,
        status: "paid",
        items: cart.map((c) => ({ productId: c.productId, description: c.name, quantity: c.qty, unit: c.unit, unitPrice: c.price, vatRate: c.vatRate, discount: c.discount || 0 })),
      }),
    });
    if (res.ok) {
      const inv = await res.json();
      window.open(`/parastatika/${inv.id}`, "_blank");
      setLastSale(inv.number);
      setCart([]); setTendered(""); setCustomerId(""); setQuery("");
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ? t(err.error) : t("common.error"));
    }
    setSaving(false);
    searchRef.current?.focus();
  };

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t("pos.title")}</h1>
        <div className="relative">
          <button onClick={() => setShowHeld((v) => !v)} className="btn-secondary">
            <Icon name="box" size={15} /> {t("pos.heldOrders")} {heldSales.length > 0 && <span className="badge bg-amber-100 text-amber-700">{heldSales.length}</span>}
          </button>
          {showHeld && (
            <div className="absolute right-0 top-full mt-1 card p-2 z-30 w-72 max-h-80 overflow-y-auto">
              {heldSales.length === 0 ? (
                <div className="text-sm text-slate-400 p-3">{t("pos.noHeldOrders")}</div>
              ) : heldSales.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50">
                  <button onClick={() => resumeSale(h)} className="text-left flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{h.label || t("pos.heldUnnamed")}</div>
                    <div className="text-xs text-slate-400">{(h.cart || []).length} {t("pos.heldItemsSuffix")}</div>
                  </button>
                  <button onClick={() => discardHeld(h.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Αναζήτηση / σάρωση */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 relative">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                autoFocus
                className="input pl-9"
                placeholder={t("pos.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
            {q && (
              <div className="absolute left-4 right-4 top-full mt-1 card p-1 z-20 max-h-72 overflow-y-auto">
                {matches.length === 0 ? (
                  <div className="text-sm text-slate-400 p-3">{t("pos.noMatches")}</div>
                ) : matches.map((p) => (
                  <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-left">
                    {p.image ? <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Icon name="image" size={16} /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.code || p.barcode || ""}</div>
                    </div>
                    <div className="text-sm font-semibold text-brand-700 whitespace-nowrap">{money(p.retailPrice ?? p.price, cur)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">{t("pos.colProduct")}</th>
                    <th className="table-th text-right">{t("pos.colQty")}</th>
                    <th className="table-th text-right">{t("pos.colPrice")}</th>
                    {canDiscount && <th className="table-th text-right">{t("pos.colDiscount")}</th>}
                    <th className="table-th text-right">{t("pos.colTotal")}</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={canDiscount ? 6 : 5}>{t("pos.emptyCart")}</td></tr>
                  ) : cart.map((c, idx) => {
                    const prod = products.find((p) => p.id === c.productId);
                    return (
                    <tr key={idx}>
                      <td className="table-td font-medium">
                        <div className="flex items-center gap-2">
                          {prod?.image ? <img src={prod.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Icon name="image" size={14} /></div>}
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="table-td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => updateLine(idx, { qty: Math.max(1, c.qty - 1) })} className="btn-ghost !px-2 !py-1">−</button>
                          <input type="number" step="any" className="input !w-16 !py-1 text-right" value={c.qty} onChange={(e) => updateLine(idx, { qty: Math.max(0, Number(e.target.value)) })} />
                          <button onClick={() => updateLine(idx, { qty: c.qty + 1 })} className="btn-ghost !px-2 !py-1">+</button>
                        </div>
                      </td>
                      <td className="table-td text-right">
                        <input type="number" step="any" className="input !w-24 !py-1 text-right ml-auto" value={c.price} onChange={(e) => updateLine(idx, { price: Number(e.target.value) })} />
                      </td>
                      {canDiscount && (
                        <td className="table-td text-right">
                          <input type="number" step="any" min="0" max="100" className="input !w-20 !py-1 text-right ml-auto" value={c.discount || 0} onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })} />
                        </td>
                      )}
                      <td className="table-td text-right font-medium">{money(computeTotals([{ quantity: c.qty, unitPrice: c.price, vatRate: c.vatRate, discount: c.discount || 0 }]).total, cur)}</td>
                      <td className="table-td text-right"><button onClick={() => removeLine(idx)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Πληρωμή / Ολοκλήρωση */}
        <div className="card p-5 h-fit space-y-4">
          <div>
            <label className="label">{t("pos.customerOptional")}</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t("pos.walkIn")}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("invoices.paymentMethod")}</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">{t("common.paymentMethods.cash")}</option>
              <option value="card">{t("common.paymentMethods.card")}</option>
              <option value="bank">{t("common.paymentMethods.bank")}</option>
              <option value="cheque">{t("common.paymentMethods.cheque")}</option>
            </select>
          </div>
          {paymentMethod === "cash" && (
            <div>
              <label className="label">{t("pos.amountTendered")}</label>
              <input type="number" step="any" className="input" value={tendered} onChange={(e) => setTendered(e.target.value)} />
              {tendered !== "" && (
                <div className={`text-sm mt-1 font-medium ${change < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {change < 0 ? t("pos.insufficientAmount") : `${t("pos.changeDue")}: ${money(change, cur)}`}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm border-t border-slate-200 pt-3">
            <div className="flex justify-between"><span className="text-slate-500">{t("common.net")}</span><span className="font-medium">{money(totals.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("common.vat")}</span><span className="font-medium">{money(totals.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-800"><span>{t("common.total")}</span><span>{money(totals.total, cur)}</span></div>
          </div>

          <div className="flex gap-2">
            <button onClick={holdSale} disabled={cart.length === 0} className="btn-secondary flex-1"><Icon name="box" size={15} /> {t("pos.holdSale")}</button>
            <button onClick={completeSale} disabled={saving || cart.length === 0 || insufficientCash} className="btn-primary flex-1">
              {saving ? t("common.saving") : t("pos.completeSale")}
            </button>
          </div>

          {lastSale && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2.5 text-center">{t("pos.saleCompleted", { number: lastSale })}</div>}
        </div>
      </div>
    </div>
  );
}
