"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function StockPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [settings, setSettings] = useState(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("products");
  const [moveFor, setMoveFor] = useState(null); // προϊόν για κίνηση
  const [move, setMove] = useState({ type: "in", quantity: 0, reason: "" });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState("");

  const load = () => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    fetch("/api/stock").then((r) => r.json()).then(setMovements);
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  };
  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const cur = settings?.currency || "€";
  // Ενοποίηση κατηγοριών: από τη λίστα κατηγοριών + όσες υπάρχουν ήδη στα προϊόντα.
  const catNames = Array.from(new Set([...categories.map((c) => c.name), ...products.map((p) => p.category).filter(Boolean)])).sort();
  const filtered = products.filter((p) => {
    if (catFilter && (p.category || "") !== catFilter) return false;
    if (!q) return true;
    const query = q.toLowerCase();
    return p.name.toLowerCase().includes(query) || (p.code || "").toLowerCase().includes(query) || (p.barcode || "").includes(query);
  });

  const delProduct = async (id) => {
    if (!confirm(t("stock.confirmDeleteProduct"))) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  };

  const submitMove = async () => {
    if (Number(move.quantity) === 0 && move.type !== "set") { alert(t("stock.errNeedQty")); return; }
    setSaving(true);
    await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: moveFor.id, ...move }) });
    setMoveFor(null); setMove({ type: "in", quantity: 0, reason: "" }); setSaving(false); load();
  };

  const stockValue = products.reduce((a, p) => a + Number(p.stock || 0) * Number(p.cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("stock.title")}</h1>
          <p className="text-slate-500 text-sm">{t("stock.summary", { count: products.length, value: money(stockValue, cur) })}</p>
        </div>
        <Link href="/apothiki/neo" className="btn-primary"><Icon name="plus" size={16} /> {t("stock.newItem")}</Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("products")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "products" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("stock.tabProducts")}</button>
        <button onClick={() => setTab("movements")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "movements" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("stock.tabMovements")}</button>
      </div>

      {tab === "products" ? (
        <>
          <div className="card p-4 flex flex-wrap gap-3 items-center">
            <div className="relative max-w-sm w-full">
              <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder={t("stock.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input max-w-[220px]" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">{t("stock.allCategories")}</option>
              {catNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th"></th>
                    <th className="table-th">{t("stock.colCode")}</th>
                    <th className="table-th">{t("stock.colName")}</th>
                    <th className="table-th">{t("stock.colBrand")}</th>
                    <th className="table-th text-right">{t("stock.colPrice")}</th>
                    <th className="table-th text-right">{t("stock.colVat")}</th>
                    <th className="table-th text-right">{t("stock.colStock")}</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={8}>{t("stock.noItems")}</td></tr>
                  ) : filtered.map((p) => {
                    const low = p.trackStock !== false && Number(p.stock) <= Number(p.lowStock || 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="table-td">
                          {p.image ? <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300"><Icon name="image" size={16} /></div>}
                        </td>
                        <td className="table-td text-slate-400">{p.code || "—"}</td>
                        <td className="table-td font-medium">{p.name}{p.category && <div className="text-xs text-slate-400">{p.category}</div>}</td>
                        <td className="table-td text-slate-500">{p.brand || "—"}</td>
                        <td className="table-td text-right">{money(p.price, cur)}</td>
                        <td className="table-td text-right">{p.vatRate}%</td>
                        <td className="table-td text-right">
                          {p.trackStock === false ? <span className="text-slate-400 text-xs">{t("stock.serviceLabel")}</span> :
                            <span className={`badge ${low ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{p.stock} {p.unit}</span>}
                        </td>
                        <td className="table-td text-right whitespace-nowrap">
                          {p.trackStock !== false && <button onClick={() => { setMoveFor(p); setMove({ type: "in", quantity: 0, reason: "" }); }} className="btn-ghost !px-2 !py-1" title={t("stock.moveModalTitle")}><Icon name="box" size={15} /></button>}
                          <Link href={`/apothiki/${p.id}`} className="btn-ghost !px-2 !py-1 inline-flex"><Icon name="edit" size={15} /></Link>
                          <button onClick={() => delProduct(p.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("stock.movDate")}</th>
                  <th className="table-th">{t("stock.movProduct")}</th>
                  <th className="table-th">{t("stock.movType")}</th>
                  <th className="table-th text-right">{t("stock.movQty")}</th>
                  <th className="table-th">{t("stock.movReason")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={5}>{t("stock.noMovements")}</td></tr>
                ) : movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="table-td">{formatDate(m.date)}</td>
                    <td className="table-td font-medium">{m.productName}</td>
                    <td className="table-td">
                      <span className={`badge ${m.type === "in" ? "bg-emerald-100 text-emerald-700" : m.type === "out" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {m.type === "in" ? t("stock.movIn") : m.type === "out" ? t("stock.movOut") : t("stock.movAdjust")}
                      </span>
                    </td>
                    <td className="table-td text-right">{m.type === "out" ? "−" : m.type === "in" ? "+" : "="}{m.quantity}</td>
                    <td className="table-td text-slate-500">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal κίνησης αποθήκης */}
      {moveFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setMoveFor(null)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">{t("stock.moveModalTitle")}</h2>
            <p className="text-sm text-slate-500 mb-4">{t("stock.moveModalSub", { name: moveFor.name, stock: moveFor.stock, unit: moveFor.unit })}</p>
            <div className="space-y-4">
              <div>
                <label className="label">{t("stock.moveType")}</label>
                <select className="input" value={move.type} onChange={(e) => setMove({ ...move, type: e.target.value })}>
                  <option value="in">{t("stock.moveIn")}</option>
                  <option value="out">{t("stock.moveOut")}</option>
                  <option value="set">{t("stock.moveSet")}</option>
                </select>
              </div>
              <div><label className="label">{move.type === "set" ? t("stock.moveNewTotal") : t("stock.moveQty")}</label><input type="number" step="any" className="input" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} /></div>
              <div><label className="label">{t("stock.moveReason")}</label><input className="input" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} placeholder={t("stock.moveReasonPlaceholder")} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setMoveFor(null)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={submitMove} disabled={saving} className="btn-primary">{saving ? "…" : t("invoices.register")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
