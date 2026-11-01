"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate, money, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { usePrintFileName } from "@/lib/usePrintFileName";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Τωρινό, ΠΛΗΡΕΣ απόθεμα ενός καταστήματος παρακαταθήκης (όχι μόνο ό,τι έφερες/πήρες πίσω) — για εκτύπωση.
export default function StoreStockSheet() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [store, setStore] = useState(undefined);
  const [products, setProducts] = useState(null);
  const [company, setCompany] = useState(null);
  const [deliveries, setDeliveries] = useState(null);

  useEffect(() => {
    fetch("/api/consignment-stores").then((r) => r.json()).then((l) => setStore(l.find((s) => s.id === id) || null));
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    fetch("/api/settings").then((r) => r.json()).then(setCompany);
    fetch("/api/consignment-deliveries").then((r) => r.json()).then(setDeliveries);
  }, [id]);

  usePrintFileName(store ? `Stock - ${store.name}` : null);

  if (store === null) return <div className="text-slate-500">{t("common.notFound")}</div>;
  if (!store || !products || !company || !deliveries) return <div className="text-slate-400">{t("common.loading")}</div>;

  const cur = company.currency || "€";
  // Τιμή πώλησης ΣΕ ΑΥΤΟ το κατάστημα: από την τελευταία παράδοση προς αυτό· αλλιώς η προτεινόμενη τιμή του προϊόντος.
  const priceOf = (p) => {
    for (const d of deliveries) {
      if (d.storeId !== id) continue;
      const it = (d.items || []).find((i) => i.productId === p.id);
      if (it && it.unitPrice != null) return Number(it.unitPrice);
    }
    return Number(p.retailPrice) || 0;
  };
  const rows = products
    .filter((p) => p.department === "perfumes")
    .map((p) => {
      const e = (p.consignmentStock || []).find((c) => c.storeId === id);
      return { p, sale: Number(e?.quantity || 0), tester: Number(e?.testers || 0) };
    })
    .filter((r) => r.sale > 0 || r.tester > 0)
    .sort((a, b) => a.p.name.localeCompare(b.p.name));
  const totalSale = rows.reduce((a, r) => a + r.sale, 0);
  const totalTester = rows.reduce((a, r) => a + r.tester, 0);
  const value = rows.reduce((a, r) => a + r.sale * priceOf(r.p), 0);

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
            <div className="text-lg font-bold text-slate-800 uppercase">{t("consignment.storeStockTitle")}</div>
            <div className="text-sm text-slate-500 mt-1">{t("invoices.dateLabel", { date: formatDate(todayISO()) })}</div>
          </div>
        </div>

        <div className="py-4 border-b border-slate-100 text-sm text-slate-700">
          <div className="font-semibold">{store.legalName || store.name}</div>
          {store.legalName && store.legalName !== store.name && <div>{store.name}</div>}
          {store.afm && <div>{t("consignment.deliveryStoreVat")}: {store.afm}</div>}
          {(store.address || store.city) && <div>{[store.address, store.city].filter(Boolean).join(", ")}</div>}
          {store.contact && <div>{t("consignment.responsiblePerson")}: {store.contact}{store.contactId ? ` — ${t("consignment.responsibleId")}: ${store.contactId}` : ""}</div>}
        </div>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500 text-xs uppercase">
              <th className="py-2 text-left">{t("invoices.colDescription")}</th>
              <th className="py-2 text-right">{t("consignment.colForSale")}</th>
              <th className="py-2 text-right">{t("consignment.tester")}</th>
              <th className="py-2 text-right">{t("consignment.colPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, sale, tester }) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-1.5">{p.name}</td>
                <td className="py-1.5 text-right font-medium">{sale}</td>
                <td className="py-1.5 text-right text-slate-500">{tester || ""}</td>
                <td className="py-1.5 text-right">{priceOf(p) ? money(priceOf(p), cur) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold text-slate-800">
              <td className="py-2">{t("consignment.storeStockTotal", { count: rows.length })}</td>
              <td className="py-2 text-right">{totalSale}</td>
              <td className="py-2 text-right">{totalTester || ""}</td>
              <td className="py-2 text-right">{money(value, cur)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-xs text-slate-400 mt-1">{t("consignment.storeStockHint")}</p>

        <div className="mt-12 grid grid-cols-2 gap-10 text-sm">
          {[
            { key: "consignment.deliveredBy", lines: [company.companyName], sig: company.signature },
            { key: "consignment.receivedBy", lines: [store.contact, store.legalName].filter(Boolean).length ? [store.contact, store.legalName].filter(Boolean) : [store.name], sig: "" },
          ].map((x) => (
            <div key={x.key}>
              <div className="font-semibold text-slate-700">{t(x.key)}</div>
              <div className="text-slate-500 text-xs">{x.lines.map((l, i) => <div key={i}>{l}</div>)}</div>
              <div className="h-14 flex items-end">{x.sig ? <img src={x.sig} alt="" className="max-h-14" /> : null}</div>
              <div className="border-t border-slate-400 pt-1 text-slate-500 text-xs">{t("consignment.signSignature")}</div>
              <div className="mt-6 border-t border-slate-300 pt-1 text-slate-500 text-xs">{t("consignment.signDate")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
