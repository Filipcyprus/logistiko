"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { money, formatDate, computeTotals } from "@/lib/format";
import Icon from "@/components/Icon";
import EmailButton from "@/components/EmailButton";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function DocView({ collection, kind, label, statusMap, canConvertToOrder, backHref }) {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [doc, setDoc] = useState(null);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = () => {
    fetch(`/api/${collection}/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d ? setDoc(d) : setNotFound(true)));
  };
  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) return <div className="text-slate-500">{t("common.notFound")} <Link href={backHref} className="text-brand-600">{t("common.returnLink")}</Link></div>;
  if (!doc || !settings) return <div className="text-slate-400">{t("common.loading")}</div>;
  const cur = settings.currency || "€";

  const setStatus = async (status) => {
    await fetch(`/api/${collection}/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  const toOrder = async () => {
    setBusy(true);
    const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), customerId: doc.customerId, items: doc.items, notes: t("documents.fromQuoteNote", { number: doc.number }) }) });
    if (res.ok) {
      const order = await res.json();
      await fetch(`/api/quotes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ordered" }) });
      router.push(`/paraggelies/${order.id}`);
    } else setBusy(false);
  };

  const toInvoice = () => {
    router.push(`/parastatika/neo?from=${collection}&id=${id}`);
  };

  const reorder = async () => {
    setBusy(true);
    const res = await fetch(`/api/${collection}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), customerId: doc.customerId, items: doc.items, notes: doc.notes }) });
    if (res.ok) { const nd = await res.json(); router.push(`${backHref}/${nd.id}`); } else setBusy(false);
  };

  const toJob = async () => {
    setBusy(true);
    const title = (doc.items?.[0]?.description || t("jobs.defaultTitle")) + (doc.items?.length > 1 ? ` +${doc.items.length - 1}` : "");
    const res = await fetch("/api/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, customerId: doc.customerId, dueDate: doc.deliveryDate || "", linkedType: collection, linkedId: doc.id, linkedNumber: doc.number, notes: doc.notes }),
    });
    if (res.ok) router.push("/ergasies"); else setBusy(false);
  };

  const st = statusMap[doc.status] || { label: doc.status, color: "bg-slate-100 text-slate-600" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <Link href={backHref} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("documents.list")}</Link>
        <div className="flex flex-wrap gap-2">
          <select className="input !py-2 max-w-[180px]" value={doc.status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={reorder} disabled={busy} className="btn-secondary"><Icon name="refresh" size={15} /> {t("documents.reorder")}</button>
          {doc.customerId && <EmailButton kind={kind} id={doc.id} defaultEmail={doc.customer?.email || ""} />}
          {!canConvertToOrder && <button onClick={toJob} disabled={busy} className="btn-secondary"><Icon name="jobs" size={15} /> {t("documents.toJob")}</button>}
          {canConvertToOrder && <button onClick={toOrder} disabled={busy || doc.status === "invoiced"} className="btn-secondary">{t("documents.toOrder")} <Icon name="arrowRight" size={15} /></button>}
          {doc.invoiceId ? (
            <Link href={`/parastatika/${doc.invoiceId}`} className="btn-secondary"><Icon name="invoice" size={15} /> {doc.invoiceNumber}</Link>
          ) : (
            <button onClick={toInvoice} disabled={busy} className="btn-primary">{t("documents.toInvoice")} <Icon name="arrowRight" size={15} /></button>
          )}
          <button onClick={() => window.print()} className="btn-secondary" title={t("common.print")}><Icon name="printer" size={15} /></button>
        </div>
      </div>

      <div className="card p-8 print-area max-w-3xl mx-auto">
        <div className="flex justify-between items-start gap-6 border-b border-slate-200 pb-5">
          <div>
            {settings.logo ? <img src={settings.logo} alt="logo" className="h-14 mb-2" /> : <div className="text-2xl font-bold text-brand-700">{settings.companyName}</div>}
            <div className="text-sm text-slate-600 mt-1 space-y-0.5">
              {settings.logo && <div className="font-semibold text-slate-800">{settings.companyName}</div>}
              {(settings.address || settings.city) && <div>{settings.address}{settings.city ? `, ${settings.city}` : ""} {settings.postalCode}</div>}
              {settings.afm && <div>{t("customers.fieldTaxId")}: {settings.afm}</div>}
              {settings.phone && <div>{t("customers.fieldPhone")}: {settings.phone}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-800 uppercase">{label}</div>
            <div className="text-2xl font-extrabold text-brand-700">{doc.number}</div>
            <div className="text-sm text-slate-500 mt-1">{t("invoices.dateLabel", { date: formatDate(doc.date) })}</div>
            {doc.validUntil && <div className="text-sm text-slate-500">{t("documents.validUntil")}: {formatDate(doc.validUntil)}</div>}
            {doc.deliveryDate && <div className="text-sm text-slate-500">{t("documents.deliveryDate")}: {formatDate(doc.deliveryDate)}</div>}
            <span className={`badge mt-2 ${st.color}`}>{st.label}</span>
          </div>
        </div>

        <div className="py-4 border-b border-slate-100">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("documents.to")}</div>
          {doc.customer ? (
            <div className="text-sm text-slate-700">
              <div className="font-semibold">{doc.customer.name}</div>
              {doc.customer.address && <div>{doc.customer.address}{doc.customer.city ? `, ${doc.customer.city}` : ""}</div>}
              {doc.customer.afm && <div>{t("customers.fieldTaxId")}: {doc.customer.afm}</div>}
              {doc.customer.phone && <div>{t("customers.fieldPhone")}: {doc.customer.phone}</div>}
            </div>
          ) : <div className="text-sm text-slate-600">—</div>}
        </div>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500 text-xs uppercase">
              <th className="py-2 text-left">{t("invoices.colDescription")}</th>
              <th className="py-2 text-right">{t("invoices.colQty")}</th>
              <th className="py-2 text-right">{t("invoices.colPrice")}</th>
              <th className="py-2 text-right">{t("invoices.colDiscount")}</th>
              <th className="py-2 text-right">{t("common.vat")}</th>
              <th className="py-2 text-right">{t("documents.total")}</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">{it.quantity} {it.unit}</td>
                <td className="py-2 text-right">{money(it.unitPrice, cur)}</td>
                <td className="py-2 text-right">{it.discount ? `${it.discount}%` : "—"}</td>
                <td className="py-2 text-right">{it.vatRate}%</td>
                <td className="py-2 text-right font-medium">{money(computeTotals([it]).total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-5">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t("documents.net")}</span><span className="font-medium">{money(doc.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("documents.vat")}</span><span className="font-medium">{money(doc.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold text-slate-800"><span>{t("documents.total")}</span><span>{money(doc.total, cur)}</span></div>
          </div>
        </div>

        {doc.notes && <div className="mt-4 text-sm text-slate-600"><b>{t("documents.notes")}:</b> {doc.notes}</div>}
        {kind === "quote" && <div className="mt-6 text-center text-sm text-slate-500 italic">{t("documents.quoteFooter")}</div>}
      </div>
    </div>
  );
}
