"use client";

import { useEffect, useState } from "react";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

const PO_STATUS_COLOR = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-sky-100 text-sky-700",
  received: "bg-emerald-100 text-emerald-700",
};

export default function AccountantPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("invoices");
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetch("/api/accountant").then((r) => r.json()).then(setData);
  }, []);

  const loadReport = () => {
    setLoadingReport(true);
    fetch(`/api/reports?from=${from}&to=${to}`).then((r) => r.json()).then(setReport).finally(() => setLoadingReport(false));
  };
  useEffect(() => { if (tab === "vat" && !report) loadReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  if (!data) return <div className="text-slate-400">{t("common.loading")}</div>;
  const cur = data.settings?.currency || "€";
  const categoryLabel = (key) => t(`expenses.categories.${key}`) || key;

  const TABS = [
    ["invoices", t("accountant.tabInvoices")],
    ["expenses", t("accountant.tabExpenses")],
    ["purchases", t("accountant.tabPurchases")],
    ["vat", t("accountant.tabVat")],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("accountant.title")}</h1>
        <p className="text-slate-500 text-sm">{t("accountant.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 flex-wrap">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{label}</button>
        ))}
      </div>

      {tab === "invoices" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("invoices.colNumber")}</th>
                  <th className="table-th">{t("invoices.colDate")}</th>
                  <th className="table-th">{t("invoices.colCustomer")}</th>
                  <th className="table-th text-right">{t("invoices.colNet")}</th>
                  <th className="table-th text-right">{t("invoices.colVat")}</th>
                  <th className="table-th text-right">{t("invoices.colTotal")}</th>
                  <th className="table-th">{t("invoices.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invoices.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={7}>{t("accountant.noInvoices")}</td></tr>
                ) : data.invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="table-td font-semibold">{i.number}</td>
                    <td className="table-td">{formatDate(i.date)}</td>
                    <td className="table-td">{i.customer || "—"}</td>
                    <td className="table-td text-right">{money(i.net, cur)}</td>
                    <td className="table-td text-right">{money(i.vat, cur)}</td>
                    <td className="table-td text-right font-semibold">{money(i.total, cur)}</td>
                    <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{i.status === "paid" ? t("invoices.statusPaid") : t("invoices.statusUnpaid")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("expenses.colDate")}</th>
                  <th className="table-th">{t("expenses.colCategory")}</th>
                  <th className="table-th">{t("expenses.colDescription")}</th>
                  <th className="table-th">{t("expenses.colSupplier")}</th>
                  <th className="table-th text-right">{t("expenses.colNet")}</th>
                  <th className="table-th text-right">{t("expenses.colVat")}</th>
                  <th className="table-th text-right">{t("expenses.colTotal")}</th>
                  <th className="table-th">{t("expenses.colAttachment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.expenses.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={8}>{t("accountant.noExpenses")}</td></tr>
                ) : data.expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="table-td">{formatDate(e.date)}</td>
                    <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{categoryLabel(e.category)}</span></td>
                    <td className="table-td font-medium">{e.description}</td>
                    <td className="table-td">{e.supplier || "—"}</td>
                    <td className="table-td text-right">{money(e.net, cur)}</td>
                    <td className="table-td text-right">{money(e.vat, cur)}</td>
                    <td className="table-td text-right font-semibold">{money(e.amount, cur)}</td>
                    <td className="table-td">
                      {e.attachment ? (
                        <a href={e.attachment.data} download={e.attachment.name} className="btn-ghost !px-2 !py-1 inline-flex" title={t("expenses.viewInvoice")}><Icon name="download" size={15} /></a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "purchases" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("purchases.colNumber")}</th>
                  <th className="table-th">{t("purchases.colDate")}</th>
                  <th className="table-th">{t("purchases.colSupplier")}</th>
                  <th className="table-th text-right">{t("common.net")}</th>
                  <th className="table-th text-right">{t("common.vat")}</th>
                  <th className="table-th text-right">{t("purchases.colTotal")}</th>
                  <th className="table-th">{t("purchases.colStatus")}</th>
                  <th className="table-th">{t("expenses.colAttachment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.purchases.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={8}>{t("accountant.noPurchases")}</td></tr>
                ) : data.purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="table-td font-semibold">{po.number}</td>
                    <td className="table-td">{formatDate(po.date)}</td>
                    <td className="table-td">{po.supplier || "—"}</td>
                    <td className="table-td text-right">{money(po.net, cur)}</td>
                    <td className="table-td text-right">{money(po.vat, cur)}</td>
                    <td className="table-td text-right font-semibold">{money(po.total, cur)}</td>
                    <td className="table-td"><span className={`badge ${PO_STATUS_COLOR[po.status] || PO_STATUS_COLOR.draft}`}>{t(`purchases.status${po.status.charAt(0).toUpperCase()}${po.status.slice(1)}`)}</span></td>
                    <td className="table-td">
                      {po.attachment ? (
                        <a href={po.attachment.data} download={po.attachment.name} className="btn-ghost !px-2 !py-1 inline-flex" title={t("expenses.viewInvoice")}><Icon name="download" size={15} /></a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "vat" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <button onClick={loadReport} className="btn-primary">{t("reports.apply")}</button>
          </div>
          {loadingReport || !report ? <div className="text-slate-400">{t("common.loading")}</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.salesTotal")}</div><div className="text-2xl font-bold text-brand-700">{money(report.salesTotal, cur)}</div><div className="text-xs text-slate-400">{t("reports.salesNetSub", { value: money(report.salesNet, cur) })}</div></div>
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.expensesTotal")}</div><div className="text-2xl font-bold text-red-600">{money(report.expensesTotal, cur)}</div><div className="text-xs text-slate-400">{t("reports.salesNetSub", { value: money(report.expensesNet, cur) })}</div></div>
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.profit")}</div><div className="text-2xl font-bold text-emerald-600">{money(report.profit, cur)}</div></div>
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.vatBalance")}</div><div className="text-2xl font-bold text-amber-600">{money(report.vatBalance, cur)}</div><div className="text-xs text-slate-400">{t("reports.vatBalanceSub", { collected: money(report.salesVat, cur), paid: money(report.expensesVat, cur) })}</div></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
