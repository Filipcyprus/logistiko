"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function DocList({ collection, title, newHref, viewHref, newLabel, statusMap }) {
  const { t } = useLanguage();
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/${collection}`).then((r) => r.json()).then(setDocs).finally(() => setLoading(false));
  };
  useEffect(load, [collection]);

  const filtered = useMemo(() => docs.filter((d) => {
    if (!q) return true;
    const query = q.toLowerCase();
    return d.number.toLowerCase().includes(query) || (d.customer?.name || "").toLowerCase().includes(query);
  }), [docs, q]);

  const del = async (id) => {
    if (!confirm(t("documents.confirmDelete"))) return;
    await fetch(`/api/${collection}/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="text-slate-500 text-sm">{t("documents.entriesCount", { count: filtered.length })}</p>
        </div>
        <Link href={newHref} className="btn-primary"><Icon name="plus" size={16} /> {newLabel}</Link>
      </div>

      <div className="card p-4">
        <div className="relative max-w-sm">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={t("documents.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">{t("documents.colNumber")}</th>
                <th className="table-th">{t("documents.colDate")}</th>
                <th className="table-th">{t("documents.colCustomer")}</th>
                <th className="table-th text-right">{t("documents.colTotal")}</th>
                <th className="table-th">{t("documents.colStatus")}</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="table-td text-slate-400" colSpan={6}>{t("common.loading")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={6}>{t("documents.noEntries")}</td></tr>
              ) : filtered.map((d) => {
                const st = statusMap[d.status] || { label: d.status, color: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="table-td font-semibold"><Link href={`${viewHref}/${d.id}`} className="text-brand-700 hover:underline">{d.number}</Link>{d.source === "b2b" && <span className="badge bg-indigo-100 text-indigo-700 ml-2">B2B</span>}</td>
                    <td className="table-td">{formatDate(d.date)}</td>
                    <td className="table-td">{d.customer?.name || "—"}</td>
                    <td className="table-td text-right font-semibold">{money(d.total)}</td>
                    <td className="table-td"><span className={`badge ${st.color}`}>{st.label}</span></td>
                    <td className="table-td text-right whitespace-nowrap">
                      <Link href={`${viewHref}/${d.id}`} className="btn-ghost !px-2 !py-1"><Icon name="eye" size={15} /></Link>
                      <button onClick={() => del(d.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
