"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money, computeTotals, todayISO } from "@/lib/format";
import LineItems, { emptyLine } from "@/components/LineItems";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NewPurchasePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [date, setDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([s, sup, p]) => {
      setSettings(s); setSuppliers(sup); setProducts(p);
      setItems([emptyLine(s.vatRate ?? 19, t("common.unit"))]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = computeTotals(items);
  const cur = settings?.currency || "€";

  const save = async () => {
    const valid = items.filter((it) => it.description && Number(it.quantity) > 0);
    if (valid.length === 0) { alert(t("purchases.errNeedLine")); return; }
    if (!supplierId) { alert(t("errors.missingSupplier")); return; }
    setSaving(true);
    const res = await fetch("/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, expectedDate, supplierId, notes, items: valid }) });
    if (res.ok) { const doc = await res.json(); router.push(`/agores/${doc.id}`); }
    else { const err = await res.json().catch(() => ({})); alert(err.error ? t(err.error) : t("common.error")); setSaving(false); }
  };

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t("purchases.newPOTitle")}</h1>
        <button onClick={() => router.push("/exoda?tab=purchases")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("purchases.back")}</button>
      </div>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">{t("purchases.supplier")} <span className="text-red-500">*</span></label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t("purchases.supplierPlaceholder")}</option>
            {suppliers.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("purchases.date")}</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("purchases.expectedDate")}</label>
          <input type="date" className="input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
      </div>

      <LineItems items={items} onChange={setItems} products={products} currency={cur} defaultVat={settings.vatRate ?? 19} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <label className="label">{t("purchases.notes")}</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="card p-5 h-fit">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t("purchases.net")}</span><span className="font-medium">{money(totals.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("purchases.vat")}</span><span className="font-medium">{money(totals.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-800"><span>{t("purchases.total")}</span><span>{money(totals.total, cur)}</span></div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full mt-4">{saving ? t("common.saving") : t("purchases.save")}</button>
        </div>
      </div>
    </div>
  );
}
