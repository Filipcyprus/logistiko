"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ProductPicker from "@/components/ProductPicker";
import { money, formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const emptyStore = { name: "", legalName: "", afm: "", address: "", city: "", phone: "", email: "", contact: "" };

export default function ConsignmentPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [tab, setTab] = useState("stock");
  const [newStore, setNewStore] = useState(emptyStore);
  const [saving, setSaving] = useState(false);

  const [activeStoreId, setActiveStoreId] = useState("");
  const [sendDate, setSendDate] = useState(todayISO());
  const [sendLines, setSendLines] = useState([{ productId: "", quantity: 1, price: "" }]);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");

  // Πωλήσεις / επιστροφές ανά κατάστημα: ποσότητες που πληκτρολογεί ο χρήστης δίπλα σε κάθε άρωμα.
  const [soldQty, setSoldQty] = useState({});
  const [backQty, setBackQty] = useState({});
  const [priceEdit, setPriceEdit] = useState({});
  const [saleDate, setSaleDate] = useState(todayISO());
  const [saleModal, setSaleModal] = useState(null); // { invoice: null|true|false, commission, payment, busy, err, result }
  const [backBusy, setBackBusy] = useState(false);
  const [storeMsg, setStoreMsg] = useState({ type: "", text: "" });

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
    // Σύνδεσμος "Δελτίο Αποστολής" από το tab Καταστήματα: ανοίγει κατευθείαν στο σωστό κατάστημα.
    const preselect = searchParams.get("storeId");
    if (preselect) setActiveStoreId(preselect);
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const cur = settings?.currency || "€";
  const perfumes = products.filter((p) => p.department === "perfumes");

  const [editingStoreId, setEditingStoreId] = useState(null);
  const addStore = async () => {
    if (!newStore.name.trim()) return;
    setSaving(true);
    if (editingStoreId) {
      await fetch(`/api/consignment-stores/${editingStoreId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStore) });
    } else {
      await fetch("/api/consignment-stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStore) });
    }
    setNewStore(emptyStore);
    setEditingStoreId(null);
    setSaving(false);
    load();
  };
  const editStore = (s) => {
    setEditingStoreId(s.id);
    setNewStore({ name: s.name || "", legalName: s.legalName || "", afm: s.afm || "", address: s.address || "", city: s.city || "", phone: s.phone || "", email: s.email || "", contact: s.contact || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEditStore = () => { setEditingStoreId(null); setNewStore(emptyStore); };
  const removeStore = async (id) => {
    if (!confirm(t("consignment.confirmRemoveStore"))) return;
    await fetch(`/api/consignment-stores/${id}`, { method: "DELETE" });
    if (editingStoreId === id) cancelEditStore();
    load();
  };

  const storeStockFor = (product, storeId) => {
    const entry = (product.consignmentStock || []).find((c) => c.storeId === storeId);
    return entry ? Number(entry.quantity || 0) : 0;
  };

  // Ανοίγει αυτόματα το πρώτο κατάστημα, ώστε η οθόνη να μη φαίνεται άδεια.
  useEffect(() => {
    if (!activeStoreId && stores.length > 0) setActiveStoreId(stores[0].id);
  }, [stores, activeStoreId]);

  const selectStore = (id) => {
    setActiveStoreId(id);
    setSoldQty({}); setBackQty({}); setStoreMsg({ type: "", text: "" });
    setSendLines([{ productId: "", quantity: 1, price: "" }]); setSendErr("");
  };

  const activeStore = stores.find((x) => x.id === activeStoreId);
  const atStore = activeStore
    ? perfumes.map((p) => ({ p, qty: storeStockFor(p, activeStoreId) })).filter((x) => x.qty > 0).sort((a, b) => a.p.name.localeCompare(b.p.name))
    : [];
  const piecesAtStore = (storeId) => perfumes.reduce((a, p) => a + storeStockFor(p, storeId), 0);

  // Τιμή πώλησης προς το κατάστημα: ό,τι έχεις γράψει εσύ εδώ, αλλιώς η τιμή του τελευταίου δελτίου αποστολής
  // προς αυτό το κατάστημα, αλλιώς η προτεινόμενη τιμή του προϊόντος.
  const priceFor = (p) => {
    const k = `${activeStoreId}:${p.id}`;
    if (priceEdit[k] !== undefined) return priceEdit[k];
    for (const d of deliveries) {
      if (d.storeId !== activeStoreId) continue;
      const it = (d.items || []).find((i) => i.productId === p.id);
      if (it && it.unitPrice != null) return it.unitPrice;
    }
    return Number(p.retailPrice) || 0;
  };

  const soldLines = atStore
    .filter((x) => Number(soldQty[x.p.id]) > 0)
    .map((x) => ({ productId: x.p.id, name: x.p.name, quantity: Number(soldQty[x.p.id]), unitPrice: Number(priceFor(x.p)) || 0 }));
  const soldGross = soldLines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const backLines = atStore.filter((x) => Number(backQty[x.p.id]) > 0).map((x) => ({ productId: x.p.id, quantity: Number(backQty[x.p.id]) }));

  const startSale = () => {
    setStoreMsg({ type: "", text: "" });
    if (soldLines.length === 0) { setStoreMsg({ type: "err", text: t("consignment.errNothingSold") }); return; }
    setSaleModal({ invoice: null, holder: "shop", commission: activeStore?.commissionPercent ?? "", payment: "cash", busy: false, err: "", result: null });
  };

  const confirmSale = async () => {
    const m = saleModal;
    const asInvoice = m.invoice === true && m.holder !== "me";
    const holdMoney = m.invoice === true && m.holder === "me";
    setSaleModal({ ...m, busy: true, err: "" });
    const res = await fetch("/api/consignment-sales", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: activeStoreId, date: saleDate,
        lines: soldLines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
        invoice: asInvoice, holdMoney, commissionPercent: asInvoice || holdMoney ? Number(m.commission || 0) : 0, paymentMethod: asInvoice ? "bank" : m.payment,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSoldQty({});
      load();
      setSaleModal({ ...m, busy: false, result: data });
    } else {
      const err = await res.json().catch(() => ({}));
      setSaleModal({ ...m, busy: false, err: err.error ? t(err.error) : t("common.error") });
    }
  };

  const doTakeBack = async () => {
    setStoreMsg({ type: "", text: "" });
    if (backLines.length === 0) return;
    setBackBusy(true);
    const res = await fetch("/api/consignment-stock/return", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: activeStoreId, date: saleDate, items: backLines }) });
    setBackBusy(false);
    if (res.ok) { setBackQty({}); setStoreMsg({ type: "ok", text: t("consignment.takeBackDone") }); load(); }
    else { const err = await res.json().catch(() => ({})); setStoreMsg({ type: "err", text: err.error ? t(err.error) : t("common.error") }); }
  };

  const addSendLine = () => setSendLines((prev) => [...prev, { productId: "", quantity: 1, price: "" }]);
  const removeSendLine = (idx) => setSendLines((prev) => prev.filter((_, i) => i !== idx));
  const updateSendLine = (idx, patch) => setSendLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const doSend = async () => {
    setSendErr("");
    const items = sendLines.filter((l) => l.productId && Number(l.quantity) > 0).map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: l.price !== "" ? Number(l.price) : undefined }));
    if (!activeStoreId || items.length === 0) { setSendErr(t("consignment.errSendFields")); return; }
    setSendBusy(true);
    const res = await fetch("/api/consignment-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: activeStoreId, date: sendDate, items }) });
    setSendBusy(false);
    if (res.ok) {
      const { deliveryId } = await res.json();
      router.push(`/consignment/delivery/${deliveryId}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setSendErr(err.error ? t(err.error) : t("common.error"));
    }
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
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">{editingStoreId ? t("consignment.editStore") : t("consignment.addStore")}</h2>
              {editingStoreId && <button onClick={cancelEditStore} className="btn-ghost text-sm">{t("common.cancel")}</button>}
            </div>
            <p className="text-xs text-slate-500">{t("consignment.storeInfoHint")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">{t("consignment.storeName")}</label><input className="input" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeLegalName")}</label><input className="input" value={newStore.legalName} onChange={(e) => setNewStore({ ...newStore, legalName: e.target.value })} placeholder={t("consignment.storeLegalNameHint")} /></div>
              <div><label className="label">{t("consignment.storeContact")}</label><input className="input" value={newStore.contact} onChange={(e) => setNewStore({ ...newStore, contact: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeAfm")}</label><input className="input" value={newStore.afm} onChange={(e) => setNewStore({ ...newStore, afm: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storePhone")}</label><input className="input" value={newStore.phone} onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeEmail")}</label><input type="email" className="input" value={newStore.email} onChange={(e) => setNewStore({ ...newStore, email: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeAddress")}</label><input className="input" value={newStore.address} onChange={(e) => setNewStore({ ...newStore, address: e.target.value })} /></div>
              <div><label className="label">{t("consignment.storeCity")}</label><input className="input" value={newStore.city} onChange={(e) => setNewStore({ ...newStore, city: e.target.value })} /></div>
            </div>
            <button onClick={addStore} disabled={saving} className="btn-primary"><Icon name={editingStoreId ? "check" : "plus"} size={15} /> {editingStoreId ? t("common.save") : t("consignment.addStore")}</button>
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
                    <td className="table-td text-right whitespace-nowrap">
                      <Link href={`/consignment/agreement?storeId=${s.id}`} className="btn-ghost !px-2 !py-1 text-brand-600" title={t("consignment.generateAgreement")}><Icon name="quote" size={14} /></Link>
                      <button
                        onClick={() => { setTab("stock"); setActiveStoreId(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className="btn-ghost !px-2 !py-1 text-brand-600"
                        title={t("consignment.generateDeliveryNote")}
                      ><Icon name="truck" size={14} /></button>
                      <button onClick={() => editStore(s)} className="btn-ghost !px-2 !py-1 text-slate-500"><Icon name="edit" size={14} /></button>
                      <button onClick={() => removeStore(s.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t("consignment.storeTabHint")}</p>
          <div className="flex flex-wrap gap-2">
            {stores.map((st) => (
              <button
                key={st.id}
                onClick={() => selectStore(st.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeStoreId === st.id ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {st.name} <span className={`ml-1 text-xs ${activeStoreId === st.id ? "text-brand-100" : "text-slate-400"}`}>{piecesAtStore(st.id)}</span>
              </button>
            ))}
            {stores.length === 0 && <span className="text-sm text-slate-400">{t("consignment.noStores")}</span>}
          </div>

          {activeStore && (
            <>
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <h2 className="font-semibold text-slate-700">{t("consignment.atStoreTitle", { store: activeStore.name })}</h2>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">{t("consignment.fieldDate")}</label>
                    <input type="date" className="input !py-1 !w-40" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                  </div>
                </div>
                {storeMsg.text && (
                  <div className={`mx-4 mt-3 text-sm rounded-lg px-3 py-2 ${storeMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{storeMsg.text}</div>
                )}
                {atStore.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400">{t("consignment.storeNothing")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="table-th">{t("consignment.colProduct")}</th>
                          <th className="table-th text-right">{t("consignment.colAtStore")}</th>
                          <th className="table-th text-right">{t("consignment.colPrice")}</th>
                          <th className="table-th text-right">{t("consignment.colSoldQty")}</th>
                          <th className="table-th text-right">{t("consignment.colTakeBack")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {atStore.map(({ p, qty }) => (
                          <tr key={p.id}>
                            <td className="table-td font-medium">{p.name}</td>
                            <td className="table-td text-right font-semibold">{qty}</td>
                            <td className="table-td text-right">
                              <input type="number" min="0" step="any" className="input !w-24 !py-1 text-right ml-auto"
                                value={priceFor(p)} onChange={(e) => setPriceEdit({ ...priceEdit, [`${activeStoreId}:${p.id}`]: e.target.value })} />
                            </td>
                            <td className="table-td text-right">
                              <input type="number" min="0" max={qty} step="any" placeholder="0" className="input !w-20 !py-1 text-right ml-auto"
                                value={soldQty[p.id] ?? ""} onChange={(e) => setSoldQty({ ...soldQty, [p.id]: e.target.value })} />
                            </td>
                            <td className="table-td text-right">
                              <input type="number" min="0" max={qty} step="any" placeholder="0" className="input !w-20 !py-1 text-right ml-auto"
                                value={backQty[p.id] ?? ""} onChange={(e) => setBackQty({ ...backQty, [p.id]: e.target.value })} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {atStore.length > 0 && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <button onClick={doTakeBack} disabled={backBusy || backLines.length === 0} className="btn-secondary disabled:opacity-40">
                      {backBusy ? t("common.saving") : t("consignment.takeBackBtn", { count: backLines.length })}
                    </button>
                    <button onClick={startSale} disabled={soldLines.length === 0} className="btn-primary disabled:opacity-40">
                      {t("consignment.registerSalesBtn", { count: soldLines.length })}
                    </button>
                  </div>
                )}
              </div>

              <div className="card p-5 space-y-3">
                <h2 className="font-semibold text-slate-700">{t("consignment.addPerfumesTitle", { store: activeStore.name })}</h2>
                <p className="text-xs text-slate-400">{t("consignment.sendPriceHint")}</p>
                {sendErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{sendErr}</div>}
                <div className="max-w-xs">
                  <label className="label">{t("consignment.fieldSendDate")}</label>
                  <input type="date" className="input" value={sendDate} onChange={(e) => setSendDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  {sendLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="label">{t("consignment.fieldProduct")}</label>
                        <ProductPicker
                          products={perfumes}
                          value={line.productId}
                          onChange={(id) => {
                            const p = perfumes.find((x) => x.id === id);
                            updateSendLine(idx, { productId: id, price: p ? (Number(p.retailPrice) || 0) : "" });
                          }}
                          formatOption={(p) => `${p.name} (${t("consignment.warehouseStock")}: ${p.stock})`}
                        />
                        {(() => { const p = perfumes.find((x) => x.id === line.productId); return p && Number(line.quantity) > Number(p.stock || 0) ? <div className="text-xs text-amber-600 mt-1">{t("consignment.beyondStockHint")}</div> : null; })()}
                      </div>
                      <div className="w-24">
                        <label className="label">{t("consignment.fieldQuantity")}</label>
                        <input type="number" min="1" step="any" className="input" value={line.quantity} onChange={(e) => updateSendLine(idx, { quantity: e.target.value })} />
                      </div>
                      <div className="w-28">
                        <label className="label">{t("consignment.fieldPrice")}</label>
                        <input type="number" min="0" step="any" className="input" value={line.price} onChange={(e) => updateSendLine(idx, { price: e.target.value })} placeholder={t("consignment.fieldPricePlaceholder")} />
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
                <div className="p-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-700">{t("consignment.storeDeliveriesTitle")}</h2>
                </div>
                {deliveries.filter((d) => d.storeId === activeStoreId).length === 0 ? (
                  <p className="p-5 text-sm text-slate-400">{t("consignment.noDeliveries")}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {deliveries.filter((d) => d.storeId === activeStoreId).slice(0, 20).map((d) => (
                      <div key={d.id} className="p-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-400">{formatDate(d.date)}</div>
                          <div className="text-sm text-slate-600 mt-1">{d.items.map((it) => `${it.productName} × ${it.quantity}`).join(", ")}</div>
                        </div>
                        <a href={`/consignment/delivery/${d.id}`} className="btn-secondary shrink-0"><Icon name="printer" size={14} /> {t("consignment.viewDelivery")}</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <details className="card overflow-hidden">
            <summary className="p-4 cursor-pointer font-semibold text-slate-700">{t("consignment.allStoresOverview")}</summary>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="table-th">{t("consignment.colProduct")}</th>
                    <th className="table-th text-right">{t("consignment.warehouseStock")}</th>
                    {stores.map((st) => <th key={st.id} className="table-th text-right">{st.name}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perfumes.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={2 + stores.length}>{t("consignment.noPerfumes")}</td></tr>
                  ) : perfumes.map((p) => (
                    <tr key={p.id}>
                      <td className="table-td font-medium">{p.name}</td>
                      <td className="table-td text-right">{p.stock}</td>
                      {stores.map((st) => <td key={st.id} className="table-td text-right">{storeStockFor(p, st.id)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {saleModal && activeStore && (() => {
        const m = saleModal;
        const pct = Math.min(Math.max(Number(m.commission) || 0, 0), 100);
        const commission = Math.round(soldGross * pct) / 100;
        const done = m.result;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => !m.busy && setSaleModal(null)}>
            <div className="card p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-semibold text-slate-800 text-lg">{t("consignment.saleModalTitle", { store: activeStore.name })}</h2>
              {done ? (
                <>
                  <div className="text-sm rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700">
                    {done.invoice.type === "timologio"
                      ? t("consignment.saleRecordedInvoice", { number: done.invoice.number, amount: money(done.invoice.total, cur) })
                      : done.invoice.commissionDue
                        ? t("consignment.saleRecordedHeld", { number: done.invoice.number, amount: money(done.invoice.commissionDue.amount, cur) })
                        : t("consignment.saleRecordedReceipt", { number: done.invoice.number })}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Link href={`/parastatika/${done.invoice.id}`} className="btn-secondary">{t("consignment.openDocument")} {done.invoice.number}</Link>
                    <button onClick={() => setSaleModal(null)} className="btn-primary">{t("common.close")}</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                    {soldLines.map((l) => (
                      <div key={l.productId} className="flex justify-between gap-3 px-3 py-2">
                        <span className="text-slate-700">{l.quantity} × {l.name}</span>
                        <span className="text-slate-600 whitespace-nowrap">{money(l.quantity * l.unitPrice, cur)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 font-semibold bg-slate-50"><span>{t("consignment.salesTotal")}</span><span>{money(soldGross, cur)}</span></div>
                  </div>

                  <div>
                    <div className="font-medium text-slate-700 mb-2">{t("consignment.invoiceAsk")}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button onClick={() => setSaleModal({ ...m, invoice: true })} className={`text-left rounded-lg border p-3 ${m.invoice === true ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}>
                        <div className="font-medium text-slate-800">{t("consignment.invoiceYes")}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t("consignment.invoiceYesHint")}</div>
                      </button>
                      <button onClick={() => setSaleModal({ ...m, invoice: false })} className={`text-left rounded-lg border p-3 ${m.invoice === false ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}>
                        <div className="font-medium text-slate-800">{t("consignment.invoiceNo")}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t("consignment.invoiceNoHint")}</div>
                      </button>
                    </div>
                  </div>

                  {m.invoice === true && (
                    <div className="space-y-3">
                      <div>
                        <div className="font-medium text-slate-700 mb-2">{t("consignment.holderAsk")}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button onClick={() => setSaleModal({ ...m, holder: "shop" })} className={`text-left rounded-lg border p-3 ${m.holder !== "me" ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}>
                            <div className="font-medium text-slate-800">{t("consignment.holderShop")}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{t("consignment.holderShopHint")}</div>
                          </button>
                          <button onClick={() => setSaleModal({ ...m, holder: "me" })} className={`text-left rounded-lg border p-3 ${m.holder === "me" ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"}`}>
                            <div className="font-medium text-slate-800">{t("consignment.holderMe")}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{t("consignment.holderMeHint")}</div>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">{t("consignment.commissionLabel")}</label>
                        <input type="number" min="0" max="100" step="any" autoFocus className="input" value={m.commission} onChange={(e) => setSaleModal({ ...m, commission: e.target.value })} placeholder="0" />
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-slate-500">{t("consignment.salesTotal")}</span><span>{money(soldGross, cur)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">{t("consignment.commissionAmount")} ({pct}%)</span><span>{m.holder === "me" ? "" : "−"}{money(commission, cur)}</span></div>
                        {m.holder === "me" ? (
                          <div className="flex justify-between font-semibold border-t border-slate-200 pt-1"><span>{t("consignment.amountDueShop")}</span><span>{money(commission, cur)}</span></div>
                        ) : (
                          <div className="flex justify-between font-semibold border-t border-slate-200 pt-1"><span>{t("consignment.shopPays")}</span><span>{money(soldGross - commission, cur)}</span></div>
                        )}
                      </div>
                      {m.holder === "me" && (
                        <div>
                          <label className="label">{t("consignment.howReceived")}</label>
                          <select className="input" value={m.payment} onChange={(e) => setSaleModal({ ...m, payment: e.target.value })}>
                            <option value="cash">{t("common.paymentMethods.cash")}</option>
                            <option value="card">{t("common.paymentMethods.card")}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  {m.invoice === false && (
                    <div>
                      <label className="label">{t("invoices.paymentMethod")}</label>
                      <select className="input" value={m.payment} onChange={(e) => setSaleModal({ ...m, payment: e.target.value })}>
                        <option value="cash">{t("common.paymentMethods.cash")}</option>
                        <option value="card">{t("common.paymentMethods.card")}</option>
                      </select>
                    </div>
                  )}

                  {m.err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{m.err}</div>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setSaleModal(null)} disabled={m.busy} className="btn-secondary">{t("common.cancel")}</button>
                    <button onClick={confirmSale} disabled={m.busy || m.invoice === null} className="btn-primary disabled:opacity-40">
                      {m.busy ? t("common.saving") : m.invoice === true && m.holder !== "me" ? t("consignment.createInvoiceBtn") : t("consignment.recordReceiptBtn")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

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
                    <td className="table-td text-right font-medium">{money(s.total, cur)}{s.commissionPercent ? <div className="text-xs font-normal text-slate-400">−{s.commissionPercent}%</div> : null}</td>
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
