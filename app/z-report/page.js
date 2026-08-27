"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }

export default function ZReportPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(thisMonth());
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setR(null);
    const qs = mode === "day" ? `mode=day&date=${date}` : `mode=month&month=${month}`;
    fetch(`/api/z-report?${qs}`).then((x) => x.json()).then(setR).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const methodLabel = (key) => t(`common.paymentMethods.${key}`) || key;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-800">{t("zReport.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("zReport.subtitle")}</p>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3 no-print">
        <div className="flex gap-1 bg-slate-100 rounded-md p-1">
          <button onClick={() => setMode("day")} className={`px-3 py-1.5 rounded text-sm font-medium ${mode === "day" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{t("zReport.tabDaily")}</button>
          <button onClick={() => setMode("month")} className={`px-3 py-1.5 rounded text-sm font-medium ${mode === "month" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{t("zReport.tabMonthly")}</button>
        </div>
        {mode === "day" ? (
          <div><label className="label">{t("zReport.date")}</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        ) : (
          <div><label className="label">{t("zReport.month")}</label><input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        )}
        <button onClick={load} className="btn-primary">{t("zReport.apply")}</button>
        <button onClick={() => window.print()} className="btn-secondary ml-auto"><Icon name="printer" size={15} /> {t("zReport.print")}</button>
      </div>

      {loading || !r || r.mode !== mode ? <div className="text-slate-400">{t("common.loading")}</div> : (
        <div className="print-area space-y-6">
          <div className="hidden print:block mb-2">
            <h2 className="text-xl font-bold">{t("zReport.printTitle", { period: r.period })}</h2>
            <p className="text-sm text-slate-500">
              {mode === "day" ? t("zReport.printSubtitleDay", { date: r.period }) : t("zReport.printSubtitleMonth", { month: r.period })}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-5"><div className="text-sm text-slate-500">{t("zReport.receiptCount")}</div><div className="text-2xl font-bold text-slate-800">{r.count}</div></div>
            <div className="card p-5"><div className="text-sm text-slate-500">{t("zReport.netSales")}</div><div className="text-2xl font-bold text-brand-700">{money(r.net)}</div></div>
            <div className="card p-5"><div className="text-sm text-slate-500">{t("zReport.vatCollected")}</div><div className="text-2xl font-bold text-amber-600">{money(r.vat)}</div></div>
            <div className="card p-5"><div className="text-sm text-slate-500">{t("zReport.grossSales")}</div><div className="text-2xl font-bold text-emerald-600">{money(r.total)}</div></div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">{t("zReport.byVatRateTitle")}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("zReport.colVatRate")}</th><th className="table-th text-right">{t("zReport.colNet")}</th><th className="table-th text-right">{t("zReport.colVat")}</th><th className="table-th text-right">{t("zReport.colGross")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.byVatRate.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={4}>{t("zReport.noData")}</td></tr> : r.byVatRate.map((x, i) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="table-td font-medium">{x.rate}%</td><td className="table-td text-right">{money(x.net)}</td><td className="table-td text-right">{money(x.vat)}</td><td className="table-td text-right font-semibold">{money(x.gross)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">{t("zReport.byPaymentMethodTitle")}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("zReport.colMethod")}</th><th className="table-th text-right">{t("zReport.colCount")}</th><th className="table-th text-right">{t("zReport.colTotal")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.byPaymentMethod.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={3}>{t("zReport.noData")}</td></tr> : r.byPaymentMethod.map((x, i) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="table-td font-medium">{methodLabel(x.method)}</td><td className="table-td text-right">{x.count}</td><td className="table-td text-right font-semibold">{money(x.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {mode === "day" ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">{t("zReport.receiptsTitle")}</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("zReport.colNumber")}</th><th className="table-th">{t("zReport.colTime")}</th><th className="table-th">{t("zReport.colCustomer")}</th><th className="table-th">{t("zReport.colMethod")}</th><th className="table-th text-right">{t("zReport.colTotal")}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.receipts.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={5}>{t("zReport.noData")}</td></tr> : r.receipts.map((x) => (
                      <tr key={x.id} className="hover:bg-slate-50">
                        <td className="table-td font-medium">{x.number}</td>
                        <td className="table-td text-sm">{x.time ? new Date(x.time).toLocaleTimeString().slice(0, 5) : "—"}</td>
                        <td className="table-td">{x.customer || "—"}</td>
                        <td className="table-td">{methodLabel(x.paymentMethod)}</td>
                        <td className="table-td text-right font-semibold">{money(x.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">{t("zReport.byDayTitle")}</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("zReport.colDate")}</th><th className="table-th text-right">{t("zReport.receiptCount")}</th><th className="table-th text-right">{t("zReport.colNet")}</th><th className="table-th text-right">{t("zReport.colVat")}</th><th className="table-th text-right">{t("zReport.colTotal")}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.byDay.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={5}>{t("zReport.noData")}</td></tr> : r.byDay.map((x, i) => (
                      <tr key={i} className="hover:bg-slate-50"><td className="table-td font-medium">{x.date}</td><td className="table-td text-right">{x.count}</td><td className="table-td text-right">{money(x.net)}</td><td className="table-td text-right">{money(x.vat)}</td><td className="table-td text-right font-semibold">{money(x.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
