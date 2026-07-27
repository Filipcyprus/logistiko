"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ConsignmentDeliveryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/consignment-deliveries/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d ? setData(d) : setNotFound(true)));
  }, [id]);

  if (notFound) return (
    <div className="text-slate-500">
      {t("common.notFound")} <Link href="/consignment" className="text-brand-600">{t("common.returnLink")}</Link>
    </div>
  );
  if (!data) return <div className="text-slate-400">{t("common.loading")}</div>;

  const { delivery, store, company } = data;

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
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-800 uppercase">{t("consignment.deliveryNoteTitle")}</div>
            <div className="text-sm text-slate-500 mt-1">{t("invoices.dateLabel", { date: formatDate(delivery.date) })}</div>
          </div>
        </div>

        <div className="py-4 border-b border-slate-100">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("consignment.deliveryToStore")}</div>
          <div className="text-sm text-slate-700">
            <div className="font-semibold">{delivery.storeName}</div>
            {store?.address && <div>{store.address}</div>}
            {store?.contact && <div>{t("consignment.storeContact")}: {store.contact}</div>}
            {store?.phone && <div>{t("customers.fieldPhone")}: {store.phone}</div>}
          </div>
        </div>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500 text-xs uppercase">
              <th className="py-2 text-left">{t("invoices.colDescription")}</th>
              <th className="py-2 text-right">{t("invoices.colQty")}</th>
            </tr>
          </thead>
          <tbody>
            {delivery.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{it.productName}</td>
                <td className="py-2 text-right">{it.quantity} {it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-t border-slate-300 pt-2 text-slate-500">{t("consignment.deliveredBy")}</div>
          </div>
          <div>
            <div className="border-t border-slate-300 pt-2 text-slate-500">{t("consignment.receivedBy")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
