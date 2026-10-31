"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, money } from "@/lib/format";
import Icon from "@/components/Icon";
import { usePrintFileName } from "@/lib/usePrintFileName";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Τιμολόγιο προμήθειας: από εμάς προς το κατάστημα, μόνο για το ποσό που του δίνουμε.
export default function CommissionInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/commission-invoices/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d ? setData(d) : setNotFound(true)));
  }, [id]);

  usePrintFileName(data ? `${data.doc.number} - ${data.doc.storeName}` : null);

  if (notFound) return (
    <div className="text-slate-500">
      {t("common.notFound")} <Link href="/consignment" className="text-brand-600">{t("common.returnLink")}</Link>
    </div>
  );
  if (!data) return <div className="text-slate-400">{t("common.loading")}</div>;

  const { doc, store, company } = data;
  const cur = company.currency;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <button onClick={() => router.push("/consignment")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("consignment.title")}</button>
        <button onClick={() => window.print()} className="btn-primary"><Icon name="printer" size={15} /> {t("common.print")}</button>
      </div>

      <div className="card p-8 print-area max-w-3xl mx-auto">
        <div className="flex justify-between items-start gap-6 border-b border-slate-200 pb-5">
          <div>
            {company.logo ? <img src={company.logo} alt="logo" className="h-14 mb-2" /> : <div className="text-2xl font-bold text-brand-700">{company.companyName}</div>}
            <div className="text-sm text-slate-600 mt-1 space-y-0.5">
              {company.logo && <div className="font-semibold text-slate-800">{company.companyName}</div>}
              {(company.address || company.city) && <div>{company.address}{company.city ? `, ${company.city}` : ""} {company.postalCode}</div>}
              {company.afm && <div>{t("customers.fieldTaxId")}: {company.afm}</div>}
              {company.phone && <div>{t("customers.fieldPhone")}: {company.phone}</div>}
              {company.email && <div>{company.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-800 uppercase">{t("consignment.commissionInvoiceTitle")}</div>
            <div className="text-xl font-bold text-brand-700 mt-1">{doc.number}</div>
            <div className="text-sm text-slate-500 mt-1">{t("invoices.dateLabel", { date: formatDate(doc.date) })}</div>
            <div className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${doc.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {doc.paid ? t("consignment.commissionPaid") : t("consignment.commissionUnpaid")}
            </div>
          </div>
        </div>

        <div className="py-4 border-b border-slate-100">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("consignment.commissionInvoiceTo")}</div>
          <div className="text-sm text-slate-700">
            <div className="font-semibold">{store?.legalName || doc.storeName}</div>
            {store?.legalName && store.legalName !== doc.storeName && <div>{doc.storeName}</div>}
            {store?.afm && <div>{t("consignment.deliveryStoreVat")}: {store.afm}</div>}
            {(store?.address || store?.city) && <div>{[store.address, store.city].filter(Boolean).join(", ")}</div>}
            {store?.phone && <div>{t("customers.fieldPhone")}: {store.phone}</div>}
            {store?.email && <div>{store.email}</div>}
          </div>
        </div>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500 text-xs uppercase">
              <th className="py-2 text-left">{t("invoices.colDescription")}</th>
              <th className="py-2 text-right">{t("consignment.colTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">
                  <div className="font-medium">{t("consignment.commissionLineLabel", { percent: doc.percent })}</div>
                  <div className="text-xs text-slate-500">{l.description}</div>
                </td>
                <td className="py-2 text-right">{money(l.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold text-slate-800 text-base">
              <td className="py-3">{t("consignment.commissionTotalDue")}</td>
              <td className="py-3 text-right">{money(doc.amount, cur)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-3 text-xs text-slate-500 space-y-1">
          <div>{t("consignment.commissionBasis", { sales: money(doc.salesTotal, cur), percent: doc.percent, receipt: doc.receiptNumber })}</div>
          {doc.bonusPercent > 0 && <div>{t("consignment.commissionBonusLine", { base: doc.basePercent, bonus: doc.bonusPercent })}</div>}
          <div>{t("consignment.commissionNoVat")}</div>
        </div>
      </div>
    </div>
  );
}
