"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money, computeTotals, todayISO } from "@/lib/format";
import LineItems, { emptyLine } from "@/components/LineItems";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Κοινή φόρμα δημιουργίας Προσφοράς / Παραγγελίας.
export default function DocForm({ collection, title, dateFieldLabel, backHref }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [date, setDate] = useState(todayISO());
  const [secondDate, setSecondDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([s, c, p]) => {
      setSettings(s); setCustomers(c); setProducts(p);
      setItems([emptyLine(s.vatRate ?? 24, t("common.unit"))]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = computeTotals(items);
  const cur = settings?.currency || "€";
  const isQuote = collection === "quotes";

  const save = async () => {
    const valid = items.filter((it) => it.description && Number(it.quantity) > 0);
    if (valid.length === 0) { alert(t("documents.errNeedLine")); return; }
    setSaving(true);
    const body = {
      date, customerId: customerId || null, notes, items: valid,
      ...(isQuote ? { validUntil: secondDate } : { deliveryDate: secondDate }),
    };
    const res = await fetch(`/api/${collection}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const doc = await res.json();
      router.push(`${backHref}/${doc.id}`);
    } else {
      const err = await res.json();
      alert(err.error ? t(err.error) : t("documents.errGeneric")); setSaving(false);
    }
  };

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <button onClick={() => router.push(backHref)} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("documents.back")}</button>
      </div>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">{t("invoices.date")}</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{dateFieldLabel}</label>
          <input type="date" className="input" value={secondDate} onChange={(e) => setSecondDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("documents.customer")}</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">{t("documents.customerPlaceholder")}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <LineItems items={items} onChange={setItems} products={products} currency={cur} defaultVat={settings.vatRate ?? 24} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <label className="label">{t("documents.notes")}</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="card p-5 h-fit">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t("documents.net")}</span><span className="font-medium">{money(totals.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("documents.vat")}</span><span className="font-medium">{money(totals.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-800"><span>{t("documents.total")}</span><span>{money(totals.total, cur)}</span></div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full mt-4">{saving ? t("common.saving") : t("documents.save")}</button>
        </div>
      </div>
    </div>
  );
}
