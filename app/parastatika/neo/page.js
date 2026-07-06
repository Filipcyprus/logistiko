"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { money, computeTotals, todayISO } from "@/lib/format";
import LineItems, { emptyLine } from "@/components/LineItems";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function NewInvoiceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLanguage();
  const fromColl = params.get("from"); // "quotes" | "orders"
  const fromId = params.get("id");

  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [kind, setKind] = useState("apodeixi");
  const [series, setSeries] = useState("A");
  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [status, setStatus] = useState("paid");
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
      setSeries(s.series || "A");
      setItems([emptyLine(s.vatRate ?? 19, t("common.unit"))]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Προσυμπλήρωση από προσφορά/παραγγελία
  useEffect(() => {
    if (!fromColl || !fromId) return;
    fetch(`/api/${fromColl}/${fromId}`).then((r) => (r.ok ? r.json() : null)).then((doc) => {
      if (!doc) return;
      if (doc.customerId) { setCustomerId(doc.customerId); setKind("timologio"); }
      setItems(doc.items.map((it) => ({ ...it })));
      setNotes(t("invoices.prefillNote", { source: fromColl === "quotes" ? t("invoices.fromQuote") : t("invoices.fromOrder"), number: doc.number }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromColl, fromId]);

  const totals = computeTotals(items);
  const cur = settings?.currency || "€";

  const save = async () => {
    const valid = items.filter((it) => it.description && Number(it.quantity) > 0);
    if (valid.length === 0) { alert(t("invoices.errNeedLine")); return; }
    if (kind === "timologio" && !customerId) { alert(t("invoices.errNeedCustomer")); return; }
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: kind, series, date, customerId: customerId || null,
        paymentMethod, status, notes, items: valid,
        sourceType: fromColl || null, sourceId: fromId || null,
      }),
    });
    if (res.ok) { const inv = await res.json(); router.push(`/parastatika/${inv.id}`); }
    else { const err = await res.json(); alert(err.error ? t(err.error) : t("common.error")); setSaving(false); }
  };

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("invoices.newTitle")}
          {fromColl && <span className="text-sm font-normal text-slate-400">{t("invoices.fromSuffix", { source: fromColl === "quotes" ? t("invoices.fromQuote") : t("invoices.fromOrder") })}</span>}
        </h1>
        <button onClick={() => router.push("/parastatika")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("invoices.backToList")}</button>
      </div>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="label">{t("invoices.kind")}</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="apodeixi">{t("invoices.kindReceipt")}</option>
            <option value="timologio">{t("invoices.kindInvoice")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("invoices.series")}</label>
          <input className="input" value={series} onChange={(e) => setSeries(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("invoices.date")}</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("invoices.customer")} {kind === "timologio" && <span className="text-red-500">*</span>}</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">{t("invoices.customerRetailOption")}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.afm ? ` (${t("customers.fieldTaxId")} ${c.afm})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("invoices.paymentMethod")}</label>
          <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">{t("common.paymentMethods.cash")}</option>
            <option value="card">{t("common.paymentMethods.card")}</option>
            <option value="bank">{t("common.paymentMethods.bank")}</option>
            <option value="cheque">{t("common.paymentMethods.cheque")}</option>
          </select>
        </div>
      </div>

      <LineItems items={items} onChange={setItems} products={products} currency={cur} defaultVat={settings.vatRate ?? 19} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <label className="label">{t("invoices.notes")}</label>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="card p-5">
            <label className="label">{t("invoices.paymentStatus")}</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={status === "paid"} onChange={() => setStatus("paid")} /> {t("invoices.paid")}</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={status === "unpaid"} onChange={() => setStatus("unpaid")} /> {t("invoices.unpaidCredit")}</label>
            </div>
          </div>
        </div>

        <div className="card p-5 h-fit">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t("common.net")}</span><span className="font-medium">{money(totals.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("common.vat")}</span><span className="font-medium">{money(totals.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-800"><span>{t("common.total")}</span><span>{money(totals.total, cur)}</span></div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full mt-4">{saving ? t("common.saving") : t("invoices.issue")}</button>
        </div>
      </div>
    </div>
  );
}

function Fallback() {
  const { t } = useLanguage();
  return <div className="text-slate-400">{t("common.loading")}</div>;
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <NewInvoiceInner />
    </Suspense>
  );
}
