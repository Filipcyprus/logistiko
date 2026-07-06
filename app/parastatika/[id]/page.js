"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { money, formatDate, computeTotals } from "@/lib/format";
import Icon from "@/components/Icon";
import EmailButton from "@/components/EmailButton";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function InvoiceView() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [inv, setInv] = useState(null);
  const [settings, setSettings] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: 0, method: "cash", date: new Date().toISOString().slice(0, 10) });

  const load = () => fetch(`/api/invoices/${id}`).then((r) => (r.ok ? r.json() : null)).then((i) => (i ? setInv(i) : setNotFound(true)));
  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) return <div className="text-slate-500">{t("invoices.viewNotFound")} <Link href="/parastatika" className="text-brand-600">{t("common.returnLink")}</Link></div>;
  if (!inv || !settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  const cur = settings.currency || "€";
  const isCredit = inv.type === "credit";
  const isTim = inv.type === "timologio";
  const balance = Math.round((Number(inv.total) - Number(inv.paidAmount || 0)) * 100) / 100;
  const docTitle = isCredit ? t("invoices.docCredit") : isTim ? t("invoices.docInvoice") : t("invoices.docReceipt");

  const createCreditNote = async () => {
    if (!confirm(t("invoices.confirmCreditNote"))) return;
    setBusy(true);
    const res = await fetch(`/api/invoices/${id}/credit`, { method: "POST" });
    if (res.ok) { const cn = await res.json(); router.push(`/parastatika/${cn.id}`); }
    else { const err = await res.json().catch(() => ({})); alert(err.error ? t(err.error) : t("common.error")); setBusy(false); }
  };

  const sign = isCredit ? -1 : 1;
  const vatGroups = {};
  for (const it of inv.items) {
    const r = Number(it.vatRate || 0);
    const net = sign * Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount || 0) / 100);
    if (!vatGroups[r]) vatGroups[r] = { net: 0, vat: 0 };
    vatGroups[r].net += net;
    vatGroups[r].vat += net * (r / 100);
  }

  const savePayment = async () => {
    if (!inv.customerId) { alert(t("invoices.errPayRequiresCustomer")); return; }
    if (Number(pay.amount) <= 0) { alert(t("invoices.errNeedAmount")); return; }
    await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: inv.customerId, invoiceId: inv.id, ...pay }) });
    setPayOpen(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <Link href="/parastatika" className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("invoices.backToInvoices")}</Link>
        <div className="flex flex-wrap gap-2">
          {inv.customerId && <Link href={`/pelates/${inv.customerId}`} className="btn-secondary"><Icon name="users" size={15} /> {t("invoices.customerCard")}</Link>}
          {!isCredit && inv.status === "unpaid" && <button onClick={() => { setPay({ ...pay, amount: balance }); setPayOpen(true); }} className="btn-secondary"><Icon name="money" size={15} /> {t("invoices.registerPayment")}</button>}
          {!isCredit && !inv.creditNoteId && <button onClick={createCreditNote} disabled={busy} className="btn-secondary"><Icon name="invoice" size={15} /> {t("invoices.createCreditNote")}</button>}
          {inv.creditNoteId && <Link href={`/parastatika/${inv.creditNoteId}`} className="btn-secondary text-red-600">{t("invoices.creditNoteLink", { number: inv.creditNoteNumber })}</Link>}
          {inv.customerId && <EmailButton kind={isCredit ? "credit" : "invoice"} id={inv.id} defaultEmail={inv.customer?.email || ""} />}
          <button onClick={() => window.print()} className="btn-primary"><Icon name="printer" size={15} /> {t("invoices.printPdf")}</button>
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
              {settings.email && <div>{settings.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${isCredit ? "text-red-600" : "text-slate-800"}`}>{docTitle}</div>
            <div className="text-2xl font-extrabold text-brand-700">{inv.number}</div>
            {isCredit && inv.relatedNumber && <div className="text-xs text-slate-500 mt-0.5">{t("invoices.relatedInvoice", { number: inv.relatedNumber })}</div>}
            <div className="text-sm text-slate-500 mt-1">{t("invoices.dateLabel", { date: formatDate(inv.date) })}</div>
            <div className="text-xs text-slate-400">{t("invoices.seriesAA", { series: inv.series, aa: inv.aa })}</div>
            {!isCredit && <span className={`badge mt-2 ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{inv.status === "paid" ? t("invoices.statusPaid") : t("invoices.statusUnpaid")}</span>}
          </div>
        </div>

        <div className="py-4 border-b border-slate-100">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("invoices.customerDetails")}</div>
          {inv.customer ? (
            <div className="text-sm text-slate-700">
              <div className="font-semibold">{inv.customer.name}</div>
              {inv.customer.profession && <div>{inv.customer.profession}</div>}
              {inv.customer.address && <div>{inv.customer.address}{inv.customer.city ? `, ${inv.customer.city}` : ""}</div>}
              {inv.customer.afm && <div>{t("customers.fieldTaxId")}: {inv.customer.afm}</div>}
              {inv.customer.phone && <div>{t("customers.fieldPhone")}: {inv.customer.phone}</div>}
            </div>
          ) : <div className="text-sm text-slate-600">{t("invoices.retailSale")}</div>}
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
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">{it.quantity} {it.unit}</td>
                <td className="py-2 text-right">{money(it.unitPrice, cur)}</td>
                <td className="py-2 text-right">{it.discount ? `${it.discount}%` : "—"}</td>
                <td className="py-2 text-right">{it.vatRate}%</td>
                <td className="py-2 text-right font-medium">{money(sign * computeTotals([it]).total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-5">
          <div className="w-full max-w-xs space-y-1 text-sm">
            {Object.entries(vatGroups).map(([rate, g]) => (
              <div key={rate} className="flex justify-between text-slate-500"><span>{t("invoices.netVatRate", { rate })}</span><span>{money(g.net, cur)}</span></div>
            ))}
            <div className="flex justify-between"><span className="text-slate-500">{t("invoices.netTotal")}</span><span className="font-medium">{money(inv.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("invoices.vatTotal")}</span><span className="font-medium">{money(inv.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold text-slate-800"><span>{t("invoices.payable")}</span><span>{money(inv.total, cur)}</span></div>
            {inv.status === "unpaid" && (
              <>
                <div className="flex justify-between text-emerald-600"><span>{t("invoices.paidAmount")}</span><span>{money(inv.paidAmount || 0, cur)}</span></div>
                <div className="flex justify-between text-amber-600 font-semibold"><span>{t("invoices.balance")}</span><span>{money(balance, cur)}</span></div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 text-sm text-slate-600">{t("invoices.paymentMethodLine", { method: inv.paymentMethod })}</div>
        {inv.notes && <div className="mt-2 text-sm text-slate-600"><b>{t("documents.notes")}:</b> {inv.notes}</div>}
        {settings.footerNote && <div className="mt-6 text-center text-sm text-slate-500 italic">{settings.footerNote}</div>}
      </div>

      {/* Modal είσπραξης */}
      {payOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print" onClick={() => setPayOpen(false)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">{t("invoices.payModalTitle")}</h2>
            <p className="text-sm text-slate-500 mb-4">{t("invoices.payModalSub", { number: inv.number, balance: money(balance, cur) })}</p>
            <div className="space-y-4">
              <div><label className="label">{t("invoices.amount")}</label><input type="number" step="any" className="input" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
              <div><label className="label">{t("invoices.date")}</label><input type="date" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></div>
              <div><label className="label">{t("invoices.method")}</label><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                <option value="cash">{t("common.paymentMethods.cash")}</option>
                <option value="card">{t("common.paymentMethods.card")}</option>
                <option value="bank">{t("common.paymentMethods.bank")}</option>
                <option value="cheque">{t("common.paymentMethods.cheque")}</option>
              </select></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPayOpen(false)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={savePayment} className="btn-primary">{t("invoices.register")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
