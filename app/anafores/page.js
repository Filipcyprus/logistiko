"use client";

import { useEffect, useState } from "react";
import { money, num } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/reports?from=${from}&to=${to}`).then((x) => x.json()).then(setR).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // αρχική φόρτωση

  const preset = (type) => {
    const d = new Date();
    if (type === "month") { setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(today()); }
    else if (type === "quarter") { const q = Math.floor(d.getMonth() / 3); setFrom(new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10)); setTo(today()); }
    else if (type === "year") { setFrom(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)); setTo(today()); }
  };

  const categoryLabel = (key) => t(`expenses.categories.${key}`) || key;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t("reports.title")}</h1>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button onClick={load} className="btn-primary">{t("reports.apply")}</button>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => { preset("month"); }} className="btn-ghost text-sm">{t("reports.presetMonth")}</button>
          <button onClick={() => { preset("quarter"); }} className="btn-ghost text-sm">{t("reports.presetQuarter")}</button>
          <button onClick={() => { preset("year"); }} className="btn-ghost text-sm">{t("reports.presetYear")}</button>
        </div>
      </div>

      {loading || !r ? <div className="text-slate-400">{t("common.loading")}</div> : (
        <>
          {/* Σύνοψη ΦΠΑ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.salesTotal")}</div><div className="text-2xl font-bold text-brand-700">{money(r.salesTotal)}</div><div className="text-xs text-slate-400">{t("reports.salesNetSub", { value: money(r.salesNet) })}</div></div>
            <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.expensesTotal")}</div><div className="text-2xl font-bold text-red-600">{money(r.expensesTotal)}</div><div className="text-xs text-slate-400">{t("reports.salesNetSub", { value: money(r.expensesNet) })}</div></div>
            <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.profit")}</div><div className="text-2xl font-bold text-emerald-600">{money(r.profit)}</div></div>
            <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.vatBalance")}</div><div className="text-2xl font-bold text-amber-600">{money(r.vatBalance)}</div><div className="text-xs text-slate-400">{t("reports.vatBalanceSub", { collected: money(r.salesVat), paid: money(r.expensesVat) })}</div></div>
          </div>

          {/* Ανά πελάτη */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{t("reports.byCustomerTitle")}</span>
              <button onClick={() => downloadCSV(`customers-${from}_${to}.csv`, [[t("reports.colCustomer"), t("reports.colInvoices"), t("reports.colNet"), t("reports.colVat"), t("reports.colTotal")], ...r.byCustomer.map((x) => [x.name, x.count, num(x.net), num(x.vat), num(x.total)])])} className="btn-secondary text-sm"><Icon name="download" size={14} /> {t("common.csv")}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("reports.colCustomer")}</th><th className="table-th text-right">{t("reports.colInvoices")}</th><th className="table-th text-right">{t("reports.colNet")}</th><th className="table-th text-right">{t("reports.colVat")}</th><th className="table-th text-right">{t("reports.colTotal")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.byCustomer.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={5}>{t("reports.noData")}</td></tr> : r.byCustomer.map((x, i) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="table-td font-medium">{x.name}</td><td className="table-td text-right">{x.count}</td><td className="table-td text-right">{money(x.net)}</td><td className="table-td text-right">{money(x.vat)}</td><td className="table-td text-right font-semibold">{money(x.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ανά είδος */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{t("reports.byProductTitle")}</span>
              <button onClick={() => downloadCSV(`items-${from}_${to}.csv`, [[t("reports.colItem"), t("reports.colQty"), t("reports.colNetValue")], ...r.byProduct.map((x) => [x.name, num(x.qty), num(x.net)])])} className="btn-secondary text-sm"><Icon name="download" size={14} /> {t("common.csv")}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("reports.colItem")}</th><th className="table-th text-right">{t("reports.colQty")}</th><th className="table-th text-right">{t("reports.colNetValue")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.byProduct.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={3}>{t("reports.noData")}</td></tr> : r.byProduct.map((x, i) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="table-td font-medium">{x.name}</td><td className="table-td text-right">{num(x.qty)}</td><td className="table-td text-right font-semibold">{money(x.net)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Έξοδα ανά κατηγορία */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">{t("reports.byExpenseCatTitle")}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("reports.colCategory")}</th><th className="table-th text-right">{t("reports.colEntries")}</th><th className="table-th text-right">{t("reports.colAmount")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.byExpenseCategory.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={3}>{t("reports.noData")}</td></tr> : r.byExpenseCategory.map((x, i) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="table-td font-medium">{categoryLabel(x.name)}</td><td className="table-td text-right">{x.count}</td><td className="table-td text-right font-semibold">{money(x.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
