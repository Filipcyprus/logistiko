"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { money, formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const CATEGORY_KEYS = ["rawMaterials", "ink", "rent", "utilities", "payroll", "equipment", "shipping", "marketing", "general"];
const empty = { date: todayISO(), category: "general", description: "", supplier: "", net: 0, vat: 0, amount: 0, paymentMethod: "cash" };

const PO_STATUS = {
  draft: { key: "purchases.statusDraft", color: "bg-slate-100 text-slate-600" },
  sent: { key: "purchases.statusSent", color: "bg-sky-100 text-sky-700" },
  received: { key: "purchases.statusReceived", color: "bg-emerald-100 text-emerald-700" },
};

function ExpensesInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "purchases" ? "purchases" : "expenses");

  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);

  const load = () => {
    fetch("/api/expenses").then((r) => r.json()).then(setExpenses);
    fetch("/api/purchases").then((r) => r.json()).then(setPurchases);
  };
  useEffect(() => {
    load();
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const switchTab = (tb) => { setTab(tb); router.replace(tb === "purchases" ? "/exoda?tab=purchases" : "/exoda"); };

  const filtered = expenses.filter((e) => !month || (e.date || "").startsWith(month));
  const total = filtered.reduce((a, x) => a + Number(x.amount || 0), 0);
  const categoryLabel = (key) => t(`expenses.categories.${key}`) || key;
  const defaultVatRate = settings?.vatRate ?? 19;

  const updNet = (net) => {
    const vat = form.vatIncluded ? form.vat : Math.round(Number(net) * (defaultVatRate / 100) * 100) / 100;
    setForm({ ...form, net, vat, amount: Math.round((Number(net) + Number(vat)) * 100) / 100 });
  };

  const save = async () => {
    if (!form.description.trim()) { alert(t("expenses.errNeedDescription")); return; }
    setSaving(true);
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/expenses/${form.id}` : "/api/expenses";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm(null); setSaving(false); load();
  };
  const del = async (id) => {
    if (!confirm(t("expenses.confirmDelete"))) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    load();
  };
  const delPO = async (id) => {
    if (!confirm(t("purchases.confirmDelete"))) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{tab === "expenses" ? t("expenses.title") : t("purchases.title")}</h1>
          <p className="text-slate-500 text-sm">{tab === "expenses" ? t("expenses.periodTotal", { total: money(total) }) : t("purchases.countLabel", { count: purchases.length })}</p>
        </div>
        {tab === "expenses"
          ? <button onClick={() => setForm({ ...empty })} className="btn-primary"><Icon name="plus" size={16} /> {t("expenses.newExpense")}</button>
          : <Link href="/agores/nea" className="btn-primary"><Icon name="plus" size={16} /> {t("purchases.newPO")}</Link>}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => switchTab("expenses")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "expenses" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("purchases.tabExpenses")}</button>
        <button onClick={() => switchTab("purchases")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "purchases" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("purchases.tabPurchases")}</button>
      </div>

      {tab === "expenses" ? (
        <>
          <div className="card p-4 flex items-center gap-3">
            <label className="text-sm text-slate-500">{t("expenses.month")}</label>
            <input type="month" className="input max-w-[200px]" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button onClick={() => setMonth("")} className="btn-ghost text-sm">{t("expenses.all")}</button>
          </div>

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
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={8}>{t("expenses.noExpenses")}</td></tr>
                  ) : filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="table-td">{formatDate(e.date)}</td>
                      <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{categoryLabel(e.category)}</span></td>
                      <td className="table-td font-medium">{e.description}</td>
                      <td className="table-td">{e.supplier || "—"}</td>
                      <td className="table-td text-right">{money(e.net)}</td>
                      <td className="table-td text-right">{money(e.vat)}</td>
                      <td className="table-td text-right font-semibold">{money(e.amount)}</td>
                      <td className="table-td text-right whitespace-nowrap">
                        <button onClick={() => setForm({ ...empty, ...e })} className="btn-ghost !px-2 !py-1"><Icon name="edit" size={15} /></button>
                        <button onClick={() => del(e.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                      </td>
                    </tr>
                  ))}
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
                  <th className="table-th">{t("purchases.colNumber")}</th>
                  <th className="table-th">{t("purchases.colDate")}</th>
                  <th className="table-th">{t("purchases.colSupplier")}</th>
                  <th className="table-th text-right">{t("purchases.colTotal")}</th>
                  <th className="table-th">{t("purchases.colStatus")}</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={6}>{t("purchases.noEntries")}</td></tr>
                ) : purchases.map((po) => {
                  const st = PO_STATUS[po.status] || PO_STATUS.draft;
                  return (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="table-td font-semibold"><Link href={`/agores/${po.id}`} className="text-brand-700 hover:underline">{po.number}</Link></td>
                      <td className="table-td">{formatDate(po.date)}</td>
                      <td className="table-td">{po.supplier?.name || "—"}</td>
                      <td className="table-td text-right font-semibold">{money(po.total)}</td>
                      <td className="table-td"><span className={`badge ${st.color}`}>{t(st.key)}</span></td>
                      <td className="table-td text-right whitespace-nowrap">
                        <Link href={`/agores/${po.id}`} className="btn-ghost !px-2 !py-1"><Icon name="eye" size={15} /></Link>
                        <button onClick={() => delPO(po.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setForm(null)}>
          <div className="card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{form.id ? t("expenses.modalEdit") : t("expenses.modalNew")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">{t("expenses.fieldDate")}</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="label">{t("expenses.fieldCategory")}</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORY_KEYS.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">{t("expenses.fieldDescription")}</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="label">{t("expenses.fieldSupplier")}</label><input className="input" list="supplier-list" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /><datalist id="supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist></div>
              <div><label className="label">{t("expenses.fieldPaymentMethod")}</label><select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="cash">{t("common.paymentMethods.cash")}</option>
                <option value="card">{t("common.paymentMethods.card")}</option>
                <option value="bank">{t("common.paymentMethods.bank")}</option>
                <option value="cheque">{t("common.paymentMethods.cheque")}</option>
              </select></div>
              <div><label className="label">{t("expenses.fieldNet")}</label><input type="number" step="any" className="input" value={form.net} onChange={(e) => updNet(e.target.value)} /></div>
              <div><label className="label">{t("common.vat")}</label><input type="number" step="any" className="input" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value, amount: Math.round((Number(form.net) + Number(e.target.value)) * 100) / 100 })} /></div>
              <div className="sm:col-span-2"><label className="label">{t("expenses.fieldTotal")}</label><input type="number" step="any" className="input font-semibold" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesInner />
    </Suspense>
  );
}
