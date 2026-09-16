"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const TYPES = ["asset", "liability", "equity", "income", "expense"];

const TYPE_COLOR = {
  asset: "bg-sky-100 text-sky-700",
  liability: "bg-amber-100 text-amber-700",
  equity: "bg-violet-100 text-violet-700",
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
};

const emptyForm = { id: null, number: "", name: "", type: "expense" };

export default function ChartOfAccountsPage() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
    // Τα υπόλοιπα έρχονται από το ισοζύγιο, ώστε να φαίνεται αμέσως ποιοι λογαριασμοί
    // χρησιμοποιούνται πραγματικά.
    fetch("/api/trial-balance").then((r) => (r.ok ? r.json() : null)).then((tb) => {
      if (!tb) return;
      const map = {};
      for (const l of tb.lines || []) map[l.id] = l.balance;
      setBalances(map);
    });
  };

  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const cur = settings?.currency || "€";
  const accName = (a) => (a.name ? a.name : a.nameKey ? t(a.nameKey) : "");

  const save = async () => {
    setError("");
    if (!form.number.trim()) { setError(t("errors.accountNumberRequired")); return; }
    if (!form.name.trim()) { setError(t("errors.nameRequired")); return; }
    setSaving(true);
    const res = form.id
      ? await fetch(`/api/accounts/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: form.number, name: form.name, type: form.type }) })
      : await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ? t(body.error) : t("common.error"));
      return;
    }
    setForm(null);
    load();
  };

  const toggleActive = async (a) => {
    await fetch(`/api/accounts/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: a.active === false }) });
    load();
  };

  const del = async (a) => {
    if (!confirm(t("coa.confirmDelete"))) return;
    const res = await fetch(`/api/accounts/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ? t(body.error) : t("common.error"));
      return;
    }
    load();
  };

  const visible = accounts.filter((a) => showInactive || a.active !== false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("coa.title")}</h1>
          <p className="text-slate-500 text-sm max-w-2xl">{t("coa.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t("coa.showInactive")}
          </label>
          <button onClick={() => { setForm({ ...emptyForm }); setError(""); }} className="btn-primary"><Icon name="plus" size={16} /> {t("coa.newAccount")}</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">{t("coa.colNumber")}</th>
                <th className="table-th">{t("coa.colName")}</th>
                <th className="table-th">{t("coa.colType")}</th>
                <th className="table-th text-right">{t("coa.colBalance")}</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={5}>{t("common.loading")}</td></tr>
              ) : visible.map((a) => (
                <tr key={a.id} className={`hover:bg-slate-50 ${a.active === false ? "opacity-50" : ""}`}>
                  <td className="table-td font-mono text-sm text-slate-500">{a.number}</td>
                  <td className="table-td font-medium">
                    {accName(a)}
                    {a.isSystem && <span className="badge bg-slate-100 text-slate-500 ml-2 text-xs">{t("coa.builtIn")}</span>}
                    {a.active === false && <span className="badge bg-slate-100 text-slate-500 ml-2 text-xs">{t("coa.inactive")}</span>}
                  </td>
                  <td className="table-td"><span className={`badge ${TYPE_COLOR[a.type]}`}>{t(`coa.types.${a.type}`)}</span></td>
                  <td className="table-td text-right font-medium">{balances[a.id] != null ? money(balances[a.id], cur) : "—"}</td>
                  <td className="table-td text-right whitespace-nowrap">
                    <button onClick={() => { setForm({ id: a.id, number: a.number, name: accName(a), type: a.type }); setError(""); }} className="btn-ghost !px-2 !py-1"><Icon name="edit" size={15} /></button>
                    <button onClick={() => toggleActive(a)} className="btn-ghost !px-2 !py-1" title={a.active === false ? t("coa.showInactive") : t("coa.inactive")}>
                      <Icon name={a.active === false ? "check" : "x"} size={15} />
                    </button>
                    {!a.isSystem && <button onClick={() => del(a)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => !saving && setForm(null)}>
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{form.id ? t("coa.editAccount") : t("coa.newAccount")}</h2>

            <label className="label">{t("coa.colNumber")}</label>
            <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />

            <label className="label mt-3">{t("coa.colName")}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <label className="label mt-3">{t("coa.colType")}</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={!!accounts.find((a) => a.id === form.id)?.isSystem}>
              {TYPES.map((ty) => <option key={ty} value={ty}>{t(`coa.types.${ty}`)}</option>)}
            </select>

            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</div>}

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
