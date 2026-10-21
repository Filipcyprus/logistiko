"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money, formatDate, formatTime, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function InvoicesPage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  // Μαζική αλλαγή ημερομηνίας: π.χ. ξεχάστηκαν πληρωμές με κάρτα μιας μέρας και καταχωρήθηκαν την επόμενη.
  const [selected, setSelected] = useState(() => new Set());
  const yesterdayISO = () => new Date(new Date(todayISO() + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
  const [bulkDate, setBulkDate] = useState(yesterdayISO);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisibleSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  const selectedDocs = invoices.filter((i) => selected.has(i.id));
  const selectedTotal = selectedDocs.reduce((a, x) => a + Number(x.total || 0), 0);

  const applyBulkDate = async () => {
    if (!bulkDate || selectedDocs.length === 0) return;
    if (!confirm(t("invoices.bulkConfirm", { count: selectedDocs.length, date: formatDate(bulkDate) }))) return;
    setBulkBusy(true);
    let ok = 0; let failed = 0; let firstError = "";
    for (const d of selectedDocs) {
      const res = await fetch(`/api/invoices/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: bulkDate }) });
      if (res.ok) ok++;
      else { failed++; if (!firstError) { const e = await res.json().catch(() => ({})); firstError = e.error ? t(e.error) : t("common.error"); } }
    }
    setBulkBusy(false);
    alert(failed === 0 ? t("invoices.bulkDone", { count: ok, date: formatDate(bulkDate) }) : t("invoices.bulkPartial", { ok, failed, error: firstError }));
    setSelected(new Set());
    load();
  };

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

      {selected.size > 0 && (
        <div className="card p-4 flex flex-wrap items-center gap-3 !border-brand-300 bg-brand-50">
          <span className="text-sm font-semibold text-brand-800">{t("invoices.bulkSelected", { count: selected.size, total: money(selectedTotal) })}</span>
          <label className="text-sm text-slate-600 flex items-center gap-2 ml-auto">
            {t("invoices.bulkNewDate")}
            <input type="date" className="input !py-1 !w-auto" value={bulkDate} max={todayISO()} onChange={(e) => setBulkDate(e.target.value)} />
          </label>
          <button onClick={applyBulkDate} disabled={bulkBusy || !bulkDate} className="btn-primary"><Icon name="calendar" size={15} /> {bulkBusy ? t("common.saving") : t("invoices.bulkChangeDate")}</button>
          <button onClick={() => setSelected(new Set())} disabled={bulkBusy} className="btn-secondary">{t("invoices.bulkClear")}</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th !px-3 w-8"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label={t("invoices.bulkSelectAll")} /></th>
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
                <tr><td className="table-td text-slate-400" colSpan={10}>{t("common.loading")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={10}>{t("invoices.noInvoices")}</td></tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className={`hover:bg-slate-50 ${selected.has(i.id) ? "bg-brand-50/60" : ""}`}>
                    <td className="table-td !px-3"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td className="table-td font-semibold">
                      <Link href={`/parastatika/${i.id}`} className="text-brand-700 hover:underline">{i.number}</Link>
                    </td>
                    <td className="table-td">
                      <span className={`badge ${i.type === "credit" ? "bg-red-100 text-red-700" : i.type === "timologio" ? "bg-violet-100 text-violet-700" : i.isPaymentReceipt ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                        {i.type === "credit" ? t("invoices.typeCredit") : i.type === "timologio" ? t("invoices.typeInvoice") : i.isPaymentReceipt ? t("invoices.kindPaymentReceipt") : t("invoices.typeReceipt")}
                      </span>
                    </td>
                    <td className="table-td">
                      {formatDate(i.date)}
                      {i.createdAt && <div className="text-xs text-slate-400">{formatTime(i.createdAt)}</div>}
                    </td>
                    <td className="table-td">{i.customer?.name || t("common.retail")}</td>
                    <td className={`table-td text-right ${i.type === "credit" ? "text-red-600" : ""}`}>{money(i.net)}</td>
                    <td className={`table-td text-right ${i.type === "credit" ? "text-red-600" : ""}`}>{money(i.vat)}</td>
                    <td className={`table-td text-right font-semibold ${i.type === "credit" ? "text-red-600" : ""}`}>{money(i.total)}</td>
                    <td className="table-td">
                      {i.type === "credit" && i.relatedNumber && <span className="text-xs text-slate-500">{t("invoices.creditFor", { number: i.relatedNumber })}</span>}
                      {i.type !== "credit" && i.creditNoteId && (
                        <>
                          <span className="badge bg-slate-200 text-slate-700">{t("invoices.statusCredited")}</span>
                          <div className="text-xs text-slate-400 mt-0.5">{i.creditNoteNumber}</div>
                        </>
                      )}
                      {i.type !== "credit" && !i.creditNoteId && <span className={`badge ${i.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
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
