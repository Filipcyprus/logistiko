"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const empty = { name: "", afm: "", profession: "", address: "", city: "", phone: "", email: "", priceListName: "", defaultDiscount: 0, creditDays: 0, notes: "" };

export default function CustomersPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null); // null = κλειστό, αλλιώς αντικείμενο
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/customers").then((r) => r.json()).then(setCustomers);
  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) => {
    if (!q) return true;
    const query = q.toLowerCase();
    return c.name.toLowerCase().includes(query) || (c.afm || "").includes(query) || (c.phone || "").includes(query);
  });

  const save = async () => {
    if (!form.name.trim()) { alert(t("customers.errNeedName")); return; }
    setSaving(true);
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/customers/${form.id}` : "/api/customers";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm(null);
    setSaving(false);
    load();
  };

  const del = async (id) => {
    if (!confirm(t("customers.confirmDelete"))) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("customers.title")}</h1>
          <p className="text-slate-500 text-sm">{t("customers.countLabel", { count: filtered.length })}</p>
        </div>
        <button onClick={() => setForm({ ...empty })} className="btn-primary"><Icon name="plus" size={16} /> {t("customers.newCustomer")}</button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-sm">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={t("customers.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">{t("customers.colName")}</th>
                <th className="table-th">{t("customers.colTaxId")}</th>
                <th className="table-th">{t("customers.colPhone")}</th>
                <th className="table-th">{t("customers.colCity")}</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={5}>{t("customers.noCustomers")}</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="table-td font-medium"><Link href={`/pelates/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>{c.profession && <div className="text-xs text-slate-400">{c.profession}</div>}</td>
                  <td className="table-td">{c.afm || "—"}</td>
                  <td className="table-td">{c.phone || "—"}</td>
                  <td className="table-td">{c.city || "—"}</td>
                  <td className="table-td text-right whitespace-nowrap">
                    <Link href={`/pelates/${c.id}`} className="btn-ghost !px-2 !py-1" title={t("customers.tabDetails")}><Icon name="eye" size={15} /></Link>
                    <button onClick={() => setForm({ ...empty, ...c })} className="btn-ghost !px-2 !py-1"><Icon name="edit" size={15} /></button>
                    <button onClick={() => del(c.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal φόρμας */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setForm(null)}>
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{form.id ? t("customers.modalEdit") : t("customers.modalNew")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="label">{t("customers.fieldName")}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">{t("customers.fieldTaxId")}</label><input className="input" value={form.afm} onChange={(e) => setForm({ ...form, afm: e.target.value })} /></div>
              <div><label className="label">{t("customers.fieldProfession")}</label><input className="input" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} /></div>
              <div><label className="label">{t("customers.fieldPhone")}</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">{t("customers.fieldAddress")}</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><label className="label">{t("customers.fieldCity")}</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">{t("customers.fieldEmail")}</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">{t("customers.fieldPriceList")}</label><input className="input" value={form.priceListName} onChange={(e) => setForm({ ...form, priceListName: e.target.value })} placeholder={t("customers.priceListPlaceholder")} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">{t("customers.fieldDiscount")}</label><input type="number" step="any" className="input" value={form.defaultDiscount} onChange={(e) => setForm({ ...form, defaultDiscount: e.target.value })} /></div>
                <div><label className="label">{t("customers.fieldCreditDays")}</label><input type="number" className="input" value={form.creditDays} onChange={(e) => setForm({ ...form, creditDays: e.target.value })} /></div>
              </div>
              <div className="sm:col-span-2"><label className="label">{t("customers.fieldNotes")}</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
