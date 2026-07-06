"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function InvoicesPage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (type !== "all" && i.type !== type) return false;
      if (!q) return true;
      const query = q.toLowerCase();
      return (
        i.number.toLowerCase().includes(query) ||
        (i.customer?.name || "").toLowerCase().includes(query)
      );
    });
  }, [invoices, q, type]);

  const del = async (id) => {
    if (!confirm(t("invoices.confirmVoid"))) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    load();
  };

  const total = filtered.reduce((a, x) => a + Number(x.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("invoices.title")}</h1>
          <p className="text-slate-500 text-sm">{t("invoices.listSub", { count: filtered.length, total: money(total) })}</p>
        </div>
        <Link href="/parastatika/neo" className="btn-primary"><Icon name="plus" size={16} /> {t("invoices.newInvoice")}</Link>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative max-w-xs w-full">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder={t("invoices.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input max-w-[200px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">{t("invoices.allTypes")}</option>
          <option value="apodeixi">{t("invoices.receipts")}</option>
          <option value="timologio">{t("invoices.invoicesType")}</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">{t("invoices.colNumber")}</th>
                <th className="table-th">{t("invoices.colType")}</th>
                <th className="table-th">{t("invoices.colDate")}</th>
                <th className="table-th">{t("invoices.colCustomer")}</th>
                <th className="table-th text-right">{t("invoices.colNet")}</th>
                <th className="table-th text-right">{t("invoices.colVat")}</th>
                <th className="table-th text-right">{t("invoices.colTotal")}</th>
                <th className="table-th">{t("invoices.colStatus")}</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="table-td text-slate-400" colSpan={9}>{t("common.loading")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={9}>{t("invoices.noInvoices")}</td></tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="table-td font-semibold">
                      <Link href={`/parastatika/${i.id}`} className="text-brand-700 hover:underline">{i.number}</Link>
                    </td>
                    <td className="table-td">
                      <span className={`badge ${i.type === "credit" ? "bg-red-100 text-red-700" : i.type === "timologio" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                        {i.type === "credit" ? t("invoices.typeCredit") : i.type === "timologio" ? t("invoices.typeInvoice") : t("invoices.typeReceipt")}
                      </span>
                    </td>
                    <td className="table-td">{formatDate(i.date)}</td>
                    <td className="table-td">{i.customer?.name || t("common.retail")}</td>
                    <td className={`table-td text-right ${i.type === "credit" ? "text-red-600" : ""}`}>{money(i.net)}</td>
                    <td className={`table-td text-right ${i.type === "credit" ? "text-red-600" : ""}`}>{money(i.vat)}</td>
                    <td className={`table-td text-right font-semibold ${i.type === "credit" ? "text-red-600" : ""}`}>{money(i.total)}</td>
                    <td className="table-td">
                      {i.type !== "credit" && <span className={`badge ${i.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {i.status === "paid" ? t("invoices.statusPaid") : t("invoices.statusUnpaid")}
                      </span>}
                    </td>
                    <td className="table-td text-right whitespace-nowrap">
                      <Link href={`/parastatika/${i.id}`} className="btn-ghost !px-2 !py-1"><Icon name="eye" size={15} /></Link>
                      <button onClick={() => del(i.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
