"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { money, computeTotals, todayISO } from "@/lib/format";
import LineItems, { emptyLine } from "@/components/LineItems";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { shippingCostForWeightKg, boxNowCostWithVat } from "@/lib/shipping";

function NewInvoiceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLanguage();
  const fromColl = params.get("from"); // "tenders" | "orders"
  const fromId = params.get("id");
  const asCredit = params.get("credit") === "1";

  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [kind, setKind] = useState("apodeixi");
  const [series, setSeries] = useState("A");
  const [shopName, setShopName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [status, setStatus] = useState("paid");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("p2d");

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
      if (asCredit) { setStatus("unpaid"); setPaymentMethod("bank"); }
      setNotes(t("invoices.prefillNote", { source: fromColl === "tenders" ? t("invoices.fromTender") : t("invoices.fromOrder"), number: doc.number }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromColl, fromId]);

  const totals = computeTotals(items);
  const cur = settings?.currency || "€";

  // Κατά προσέγγιση βάρος από τα προϊόντα της γραμμής (μόνο για είδη συνδεδεμένα με προϊόν αποθήκης).
  const itemsWeightG = items.reduce((sum, it) => {
    if (!it.productId) return sum;
    const p = products.find((x) => x.id === it.productId);
    return sum + (Number(p?.weightG) || 0) * (Number(it.quantity) || 0);
  }, 0);
  const itemsWeightKg = itemsWeightG / 1000;
  const vatRate = settings?.vatRate ?? 19;
  const shippingCostWithVat = itemsWeightG > 0
    ? (shippingMethod === "boxnow" ? boxNowCostWithVat() : shippingCostForWeightKg(itemsWeightKg, shippingMethod))
    : 0;

  const addShippingLine = () => {
    if (shippingCostWithVat <= 0) return;
    const shippingNet = Math.round((shippingCostWithVat / (1 + vatRate / 100)) * 100) / 100;
    const methodLabel = shippingMethod === "p2p" ? t("portal.shippingP2P") : shippingMethod === "p2d" ? t("portal.shippingP2D") : t("portal.shippingBoxNow");
    setItems([...items, { productId: null, description: `${t("portal.shippingLineLabel")} (${methodLabel})`, quantity: 1, unit: t("common.unit"), unitPrice: shippingNet, vatRate, discount: 0 }]);
  };

  const save = async () => {
    const valid = items.filter((it) => it.description && Number(it.quantity) > 0);
    if (valid.length === 0) { alert(t("invoices.errNeedLine")); return; }
    if (kind === "timologio" && !customerId) { alert(t("invoices.errNeedCustomer")); return; }
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: kind === "payment_receipt" ? "apodeixi" : kind,
        isPaymentReceipt: kind === "payment_receipt",
        series, shopName, date, customerId: customerId || null,
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
          {fromColl && <span className="text-sm font-normal text-slate-400">{t("invoices.fromSuffix", { source: fromColl === "tenders" ? t("invoices.fromTender") : t("invoices.fromOrder") })}</span>}
        </h1>
        <button onClick={() => router.push("/parastatika")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("invoices.backToList")}</button>
      </div>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="label">{t("invoices.kind")}</label>
          <select
            className="input"
            value={kind}
            onChange={(e) => {
              const v = e.target.value;
              setKind(v);
              if (v === "payment_receipt" && items.length === 1 && !items[0].description) {
                setItems([{ productId: null, description: t("invoices.paymentReceiptDefaultDesc"), quantity: 1, unit: t("common.unit"), unitPrice: 0, vatRate: 0, discount: 0 }]);
              }
            }}
          >
            <option value="apodeixi">{t("invoices.kindReceipt")}</option>
            <option value="timologio">{t("invoices.kindInvoice")}</option>
            <option value="payment_receipt">{t("invoices.kindPaymentReceipt")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("invoices.series")}</label>
          <input className="input" value={series} onChange={(e) => setSeries(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("invoices.shopName")}</label>
          <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={t("invoices.shopNamePlaceholder")} />
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

      {itemsWeightG > 0 && (
        <div className="card p-5 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={shippingEnabled} onChange={(e) => setShippingEnabled(e.target.checked)} />
            {t("invoices.needsShippingToggle")}
          </label>
          {shippingEnabled && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-slate-600">
                  {t("portal.totalWeight")} (≈): <span className="font-semibold text-slate-800">{itemsWeightG >= 1000 ? `${itemsWeightKg.toFixed(2)} kg` : `${itemsWeightG} g/ml`}</span>
                </div>
              </div>
              <div>
                <label className="label">{t("portal.shippingMethod")}</label>
                <div className="grid grid-cols-3 gap-2 max-w-md">
                  <button
                    type="button"
                    onClick={() => setShippingMethod("p2p")}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border ${shippingMethod === "p2p" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"}`}
                  >
                    {t("portal.shippingP2P")}
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t("portal.shippingP2PDesc")}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingMethod("p2d")}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border ${shippingMethod === "p2d" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"}`}
                  >
                    {t("portal.shippingP2D")}
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t("portal.shippingP2DDesc")}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingMethod("boxnow")}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border ${shippingMethod === "boxnow" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500"}`}
                  >
                    {t("portal.shippingBoxNow")}
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{t("portal.shippingBoxNowDesc")}</div>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div className="text-sm text-slate-600">{t("portal.shippingLineLabel")}: <span className="font-bold text-slate-800">{money(shippingCostWithVat, cur)}</span></div>
                <button onClick={addShippingLine} className="btn-secondary text-sm"><Icon name="plus" size={14} /> {t("invoices.addShippingLine")}</button>
              </div>
            </>
          )}
        </div>
      )}

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
