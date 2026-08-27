"use client";

import { useEffect, useRef, useState } from "react";
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
  const [deptFilter, setDeptFilter] = useState("");
  const [reorderCount, setReorderCount] = useState(0);
  const [justAdded, setJustAdded] = useState(null);
  const excelInputRef = useRef();
  const [excelParsing, setExcelParsing] = useState(false);
  const [excelPreview, setExcelPreview] = useState(null); // { file, changes }
  const [excelApplying, setExcelApplying] = useState(false);
  const [excelError, setExcelError] = useState("");

  const load = () => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    fetch("/api/stock").then((r) => r.json()).then(setMovements);
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
    fetch("/api/reorder-list").then((r) => r.json()).then((list) => setReorderCount(list.length));
  };
  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  // Προσθήκη προϊόντος στη λίστα αγορών — προσβάσιμο από οπουδήποτε στη λίστα αποθέματος,
  // χωρίς να χρειάζεται να ανοίξει κανείς κατευθείαν Παραγγελία Αγοράς.
  const addToReorderList = async (productId) => {
    const res = await fetch("/api/reorder-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, quantity: 1 }) });
    if (res.ok) {
      const list = await res.json();
      setReorderCount(list.length);
      setJustAdded(productId);
      setTimeout(() => setJustAdded((cur) => (cur === productId ? null : cur)), 1500);
    }
  };

  const onExcelSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExcelError("");
    setExcelParsing(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/products/import-excel", { method: "POST", body: formData });
    setExcelParsing(false);
    if (res.ok) {
      const data = await res.json();
      setExcelPreview({ file, changes: data.changes });
    } else {
      const err = await res.json().catch(() => ({}));
      setExcelError(err.error ? t(err.error) : t("common.error"));
    }
  };

  const applyExcelImport = async () => {
    if (!excelPreview) return;
    setExcelApplying(true);
    const formData = new FormData();
    formData.append("file", excelPreview.file);
    formData.append("apply", "true");
    const res = await fetch("/api/products/import-excel", { method: "POST", body: formData });
    setExcelApplying(false);
    if (res.ok) {
      setExcelPreview(null);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      setExcelError(err.error ? t(err.error) : t("common.error"));
    }
  };

  const cur = settings?.currency || "€";
  // Ενοποίηση κατηγοριών: από τη λίστα κατηγοριών + όσες υπάρχουν ήδη στα προϊόντα.
  const catNames = Array.from(new Set([...categories.map((c) => c.name), ...products.map((p) => p.category).filter(Boolean)])).sort();
  const filtered = products.filter((p) => {
    if (deptFilter && (p.department || "") !== deptFilter) return false;
    if (catFilter && (p.category || "") !== catFilter) return false;
    if (!q) return true;
    const query = q.toLowerCase();
    return p.name.toLowerCase().includes(query) || (p.code || "").toLowerCase().includes(query) || (p.barcode || "").includes(query);
  });

  const DEPARTMENTS = [
    ["", "allDepartments"],
    ["printShop", "deptPrintShop"],
    ["barber", "deptBarber"],
    ["perfumes", "deptPerfumes"],
  ];

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
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/agores/lista" className="btn-secondary"><Icon name="cart" size={16} /> {t("stock.reorderList")}{reorderCount > 0 && <span className="badge bg-brand-100 text-brand-700 ml-1">{reorderCount}</span>}</Link>
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onExcelSelected} />
          <button onClick={() => excelInputRef.current?.click()} disabled={excelParsing} className="btn-secondary">
            <Icon name="upload" size={16} /> {excelParsing ? t("common.loading") : t("stock.importExcel")}
          </button>
          <a href="/api/products/import-excel/template" className="text-xs text-brand-600 hover:underline whitespace-nowrap">{t("stock.downloadTemplate")}</a>
          <Link href="/apothiki/neo" className="btn-primary"><Icon name="plus" size={16} /> {t("stock.newItem")}</Link>
        </div>
      </div>

      {excelError && <div className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700">{excelError}</div>}

      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("products")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "products" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("stock.tabProducts")}</button>
        <button onClick={() => setTab("movements")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "movements" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("stock.tabMovements")}</button>
      </div>

      {tab === "products" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map(([d, key]) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${deptFilter === d ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {t(`stock.${key}`)}
              </button>
            ))}
          </div>
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
                    <th className="table-th">{t("stock.fieldSku")}</th>
                    <th className="table-th">{t("stock.colName")}</th>
                    <th className="table-th">{t("stock.colBrand")}</th>
                    <th className="table-th text-right">{t("stock.colPrice")}</th>
                    <th className="table-th text-right">{t("stock.colVat")}</th>
                    <th className="table-th text-right">{t("stock.colStock")}</th>
                    <th className="table-th text-center">{t("stock.colExpiry")}</th>
                    <th className="table-th text-center">{t("stock.colSerial")}</th>
                    <th className="table-th sticky right-0 bg-slate-50 border-l border-slate-200"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={10}>{t("stock.noItems")}</td></tr>
                  ) : filtered.map((p) => {
                    const low = p.trackStock !== false && Number(p.stock) <= Number(p.lowStock || 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="table-td">
                          {p.image ? <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-contain" /></div> : <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300"><Icon name="image" size={16} /></div>}
                        </td>
                        <td className="table-td text-slate-500 text-sm">{p.sku || "—"}</td>
                        <td className="table-td font-medium">{p.name}{p.category && <div className="text-xs text-slate-400">{p.category}</div>}</td>
                        <td className="table-td text-slate-500">{p.brand || "—"}</td>
                        <td className="table-td text-right">{money(p.price, cur)}</td>
                        <td className="table-td text-right">{p.vatRate}%</td>
                        <td className="table-td text-right">
                          {p.trackStock === false ? <span className="text-slate-400 text-xs">{t("stock.serviceLabel")}</span> :
                            <span className={`badge ${low ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{p.stock} {p.unit}</span>}
                        </td>
                        <td className="table-td text-center text-sm">
                          {p.department === "perfumes" && p.trackExpiry && p.warehouseStocks?.length > 0 ? (
                            <div className="space-y-1">
                              {p.warehouseStocks.map((ws, i) => ws.expiryDate && (
                                <div key={i} className={`text-xs px-2 py-1 rounded ${new Date(ws.expiryDate) < new Date() ? "bg-red-100 text-red-700" : new Date(ws.expiryDate) < new Date(Date.now() + 30*24*60*60*1000) ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>
                                  {ws.expiryDate}
                                </div>
                              ))}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="table-td text-center text-sm">
                          {p.productType === "equipment" && p.trackSerial && p.serialNumbers?.length > 0 ? (
                            <div className="space-y-1">
                              {p.serialNumbers.map((s, i) => (
                                <div key={i} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">{s}</div>
                              ))}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="table-td text-right whitespace-nowrap sticky right-0 bg-white border-l border-slate-200">
                          <button onClick={() => addToReorderList(p.id)} className={`btn-ghost !px-2 !py-1 ${justAdded === p.id ? "text-emerald-600" : ""}`} title={t("stock.addToReorderList")}>
                            <Icon name={justAdded === p.id ? "check" : "cart"} size={15} />
                          </button>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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

      {/* Modal προεπισκόπησης εισαγωγής Excel */}
      {excelPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">{t("stock.excelPreviewTitle")}</h2>
            <p className="text-sm text-slate-500 mb-4">
              {t("stock.excelPreviewSummary", {
                updates: excelPreview.changes.filter((c) => c.action === "update").length,
                creates: excelPreview.changes.filter((c) => c.action === "create").length,
              })}
            </p>

            <div className="overflow-y-auto flex-1 border border-slate-100 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="table-th">{t("stock.colName")}</th>
                    <th className="table-th">{t("stock.excelColAction")}</th>
                    <th className="table-th text-right">{t("stock.excelColStockChange")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {excelPreview.changes.slice(0, 200).map((c, i) => (
                    <tr key={i}>
                      <td className="table-td">{c.name}</td>
                      <td className="table-td">
                        {c.action === "update"
                          ? <span className="badge bg-sky-100 text-sky-700">{t("stock.excelActionUpdate")}</span>
                          : <span className="badge bg-emerald-100 text-emerald-700">{t("stock.excelActionCreate")}</span>}
                      </td>
                      <td className="table-td text-right whitespace-nowrap">
                        {c.action === "update" ? `${c.oldStock} → ${c.newStock}` : c.newStock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelPreview.changes.length > 200 && (
                <div className="text-xs text-slate-400 text-center py-2">
                  {t("stock.excelPreviewMore", { count: excelPreview.changes.length - 200 })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setExcelPreview(null)} disabled={excelApplying} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={applyExcelImport} disabled={excelApplying} className="btn-primary">{excelApplying ? t("common.saving") : t("stock.confirmImport")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
