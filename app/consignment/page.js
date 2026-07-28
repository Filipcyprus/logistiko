"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money, formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const emptyStore = { name: "", address: "", phone: "", contact: "" };

export default function ConsignmentPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [tab, setTab] = useState("stock");
  const [newStore, setNewStore] = useState(emptyStore);
  const [saving, setSaving] = useState(false);

  const [sendStoreId, setSendStoreId] = useState("");
  const [sendDate, setSendDate] = useState(todayISO());
  const [sendLines, setSendLines] = useState([{ productId: "", quantity: 1 }]);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");

  const [sale, setSale] = useState({ productId: "", storeId: "", quantity: 1, unitPrice: 0, date: todayISO(), paymentMethod: "cash" });
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleErr, setSaleErr] = useState("");

  const load = () => {
    fetch("/api/consignment-stores").then((r) => r.json()).then(setStores);
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    fetch("/api/consignment-sales").then((r) => r.json()).then(setSales);
    fetch("/api/consignment-orders").then((r) => r.json()).then(setOrders);
    fetch("/api/consignment-deliveries").then((r) => r.json()).then(setDeliveries);
  };

  const pendingOrderCount = orders.filter((o) => o.status !== "fulfilled").length;

  const markOrderFulfilled = async (id) => {
    await fetch(`/api/consignment-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "fulfilled" }) });
    load();
  };
  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const cur = settings?.currency || "€";
  const perfumes = products.filter((p) => p.department === "perfumes");

  const addStore = async () => {
    if (!newStore.name.trim()) return;
    setSaving(true);
    await fetch("/api/consignment-stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStore) });
    setNewStore(emptyStore);
    setSaving(false);
    load();
  };
  const removeStore = async (id) => {
    if (!confirm(t("consignment.confirmRemoveStore"))) return;
    await fetch(`/api/consignment-stores/${id}`, { method: "DELETE" });
    load();
  };

  const storeStockFor = (product, storeId) => {
    const entry = (product.consignmentStock || []).find((c) => c.storeId === storeId);
    return entry ? Number(entry.quantity || 0) : 0;
  };

  const addSendLine = () => setSendLines((prev) => [...prev, { productId: "", quantity: 1 }]);
  const removeSendLine = (idx) => setSendLines((prev) => prev.filter((_, i) => i !== idx));
  const updateSendLine = (idx, patch) => setSendLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const doSend = async () => {
    setSendErr("");
    const items = sendLines.filter((l) => l.productId && Number(l.quantity) > 0).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (!sendStoreId || items.length === 0) { setSendErr(t("consignment.errSendFields")); return; }
    setSendBusy(true);
    const res = await fetch("/api/consignment-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: sendStoreId, date: sendDate, items }) });
    setSendBusy(false);
    if (res.ok) {
      const { deliveryId } = await res.json();
      router.push(`/consignment/delivery/${deliveryId}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setSendErr(err.error ? t(err.error) : t("common.error"));
    }
  };

  const saleStoreOptions = sale.productId ? perfumes.find((p) => p.id === sale.productId)?.consignmentStock?.filter((c) => Number(c.quantity) > 0) || [] : [];
  const saleMaxQty = sale.productId && sale.storeId ? storeStockFor(perfumes.find((p) => p.id === sale.productId) || {}, sale.storeId) : 0;

  const doSale = async () => {
    setSaleErr("");
    if (!sale.productId || !sale.storeId || Number(sale.quantity) <= 0) return;
    setSaleBusy(true);
    const res = await fetch("/api/consignment-sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sale) });
    setSaleBusy(false);
    if (res.ok) { setSale({ productId: "", storeId: "", quantity: 1, unitPrice: 0, date: todayISO(), paymentMethod: "cash" }); load(); }
    else { const err = await res.json().catch(() => ({})); setSaleErr(err.error ? t(err.error) : t("common.error")); }
  };

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("consignment.title")}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t("consignment.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("stock")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "stock" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("consignment.tabStock")}</button>
        <button onClick={() => setTab("sale")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "sale" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("consignment.tabRecordSale")}</button>
        <button onClick={() => setTab("requests")} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${tab === "requests" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
          {t("consignment.tabRequests")}
          {pendingOrderCount > 0 && <span className="badge bg-amber-100 text-amber-700">{pendingOrderCount}</span>}
        </button>
        <button onClick={() => setTab("history")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "history" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("consignment.tabHistory")}</button>
        <button onClick={() => setTab("stores")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "stores" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("consignment.tabStores")}</button>
      </div>

      {tab === "stores" && (
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-700">{t("consignment.addStore")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">{t("consignment.storeName")}</label><input className="input" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeContact")}</label><input className="input" value={newStore.contact} onChange={(e) => setNewStore({ ...newStore, contact: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storePhone")}</label><input className="input" value={newStore.phone} onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeAddress")}</label><input className="input" value={newStore.address} onChange={(e) => setNewStore({ ...newStore, address: e.target.value })} /></div>
            </div>
            <button onClick={addStore} disabled={saving} className="btn-primary"><Icon name="plus" size={15} /> {t("consignment.addStore")}</button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("consignment.storeName")}</th>
                  <th className="table-th">{t("consignment.storeContact")}</th>
                  <th className="table-th">{t("consignment.storePhone")}</th>
                  <th className="table-th">{t("consignment.storeAddress")}</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stores.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={5}>{t("consignment.noStores")}</td></tr>
                ) : stores.map((s) => (
                  <tr key={s.id}>
                    <td className="table-td font-medium">{s.name}</td>
                    <td className="table-td text-slate-500">{s.contact || "—"}</td>
                    <td className="table-td text-slate-500">{s.phone || "—"}</td>
                    <td className="table-td text-slate-500">{s.address || "—"}</td>
                    <td className="table-td text-right"><button onClick={() => removeStore(s.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-700">{t("consignment.sendToStore")}</h2>
            <p className="text-sm text-slate-500">{t("consignment.sendToStoreDesc")}</p>
            {sendErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{sendErr}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{t("consignment.fieldStore")}</label>
                <select className="input" value={sendStoreId} onChange={(e) => setSendStoreId(e.target.value)}>
                  <option value="">—</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t("consignment.fieldSendDate")}</label>
                <input type="date" className="input" value={sendDate} onChange={(e) => setSendDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              {sendLines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="label">{t("consignment.fieldProduct")}</label>
                    <select className="input" value={line.productId} onChange={(e) => updateSendLine(idx, { productId: e.target.value })}>
                      <option value="">—</option>
                      {perfumes.map((p) => <option key={p.id} value={p.id}>{p.name} ({t("consignment.warehouseStock")}: {p.stock})</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="label">{t("consignment.fieldQuantity")}</label>
                    <input type="number" min="1" step="any" className="input" value={line.quantity} onChange={(e) => updateSendLine(idx, { quantity: e.target.value })} />
                  </div>
                  <button onClick={() => removeSendLine(idx)} disabled={sendLines.length === 1} className="btn-ghost !px-2 !py-2 text-red-500 disabled:opacity-30"><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={addSendLine} className="btn-secondary"><Icon name="plus" size={15} /> {t("consignment.addLine")}</button>
              <button onClick={doSend} disabled={sendBusy} className="btn-primary">{sendBusy ? t("common.saving") : t("consignment.sendBtn")}</button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">{t("consignment.colProduct")}</th>
                    <th className="table-th text-right">{t("consignment.warehouseStock")}</th>
                    {stores.map((s) => <th key={s.id} className="table-th text-right">{s.name}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perfumes.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={2 + stores.length}>{t("consignment.noPerfumes")}</td></tr>
                  ) : perfumes.map((p) => (
                    <tr key={p.id}>
                      <td className="table-td font-medium">{p.name}</td>
                      <td className="table-td text-right">{p.stock}</td>
                      {stores.map((s) => <td key={s.id} className="table-td text-right">{storeStockFor(p, s.id)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">{t("consignment.deliveriesTitle")}</h2>
            </div>
            {deliveries.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">{t("consignment.noDeliveries")}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deliveries.slice(0, 20).map((d) => (
                  <div key={d.id} className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{d.storeName}</span>
                        <span className="text-xs text-slate-400">{formatDate(d.date)}</span>
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {d.items.map((it) => `${it.productName} × ${it.quantity}`).join(", ")}
                      </div>
                    </div>
                    <a href={`/consignment/delivery/${d.id}`} className="btn-secondary shrink-0"><Icon name="printer" size={14} /> {t("consignment.viewDelivery")}</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "sale" && (
        <div className="card p-5 space-y-3 max-w-2xl">
          <h2 className="font-semibold text-slate-700">{t("consignment.recordSale")}</h2>
          <p className="text-sm text-slate-500">{t("consignment.recordSaleDesc")}</p>
          {saleErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saleErr}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t("consignment.fieldProduct")}</label>
              <select className="input" value={sale.productId} onChange={(e) => setSale({ ...sale, productId: e.target.value, storeId: "" })}>
                <option value="">—</option>
                {perfumes.filter((p) => (p.consignmentStock || []).some((c) => Number(c.quantity) > 0)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("consignment.fieldStore")}</label>
              <select className="input" value={sale.storeId} onChange={(e) => setSale({ ...sale, storeId: e.target.value })} disabled={!sale.productId}>
                <option value="">—</option>
                {saleStoreOptions.map((c) => {
                  const s = stores.find((x) => x.id === c.storeId);
                  return s ? <option key={s.id} value={s.id}>{s.name} ({c.quantity} {t("consignment.available")})</option> : null;
                })}
              </select>
            </div>
            <div>
              <label className="label">{t("consignment.fieldQuantity")} {sale.storeId && <span className="text-slate-400 font-normal">(max {saleMaxQty})</span>}</label>
              <input type="number" min="1" max={saleMaxQty || undefined} step="any" className="input" value={sale.quantity} onChange={(e) => setSale({ ...sale, quantity: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("consignment.fieldUnitPrice")}</label>
              <input type="number" min="0" step="any" className="input" value={sale.unitPrice} onChange={(e) => setSale({ ...sale, unitPrice: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("consignment.fieldDate")}</label>
              <input type="date" className="input" value={sale.date} onChange={(e) => setSale({ ...sale, date: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("invoices.paymentMethod")}</label>
              <select className="input" value={sale.paymentMethod} onChange={(e) => setSale({ ...sale, paymentMethod: e.target.value })}>
                <option value="cash">{t("common.paymentMethods.cash")}</option>
                <option value="card">{t("common.paymentMethods.card")}</option>
              </select>
            </div>
          </div>
          <button onClick={doSale} disabled={saleBusy} className="btn-primary w-full">{saleBusy ? t("common.saving") : t("consignment.recordSale")}</button>
        </div>
      )}

      {tab === "requests" && (
        <div className="card overflow-hidden">
          {orders.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">{t("consignment.noRequests")}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((o) => (
                <div key={o.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{o.storeName}</span>
                      <span className="text-xs text-slate-400">{formatDate(o.createdAt)}</span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {o.items.map((it) => `${it.productName} × ${it.quantity}${it.isTester ? ` (${t("consignment.tester")})` : ""}`).join(", ")}
                    </div>
                    {o.notes && <div className="text-xs text-slate-400 mt-1">{o.notes}</div>}
                  </div>
                  {o.status === "fulfilled" ? (
                    <span className="badge bg-emerald-100 text-emerald-700 shrink-0">{t("consignment.requestFulfilled")}</span>
                  ) : (
                    <button onClick={() => markOrderFulfilled(o.id)} className="btn-secondary shrink-0">{t("consignment.markFulfilled")}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("consignment.colDate")}</th>
                  <th className="table-th">{t("consignment.colStore")}</th>
                  <th className="table-th">{t("consignment.colProduct")}</th>
                  <th className="table-th text-right">{t("consignment.colQty")}</th>
                  <th className="table-th text-right">{t("consignment.colPrice")}</th>
                  <th className="table-th text-right">{t("consignment.colTotal")}</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={7}>{t("consignment.noSales")}</td></tr>
                ) : sales.map((s) => (
                  <tr key={s.id}>
                    <td className="table-td">{formatDate(s.date)}</td>
                    <td className="table-td">{s.storeName}</td>
                    <td className="table-td">{s.productName}</td>
                    <td className="table-td text-right">{s.quantity}</td>
                    <td className="table-td text-right">{money(s.unitPrice, cur)}</td>
                    <td className="table-td text-right font-medium">{money(s.total, cur)}</td>
                    <td className="table-td text-right">
                      <a href={`/parastatika/${s.invoiceId}`} className="text-brand-600 text-xs font-medium">{s.invoiceNumber}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
