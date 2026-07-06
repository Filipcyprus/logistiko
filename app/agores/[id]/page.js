"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { money, formatDate, computeTotals } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const STATUS = {
  draft: { key: "purchases.statusDraft", color: "bg-slate-100 text-slate-600" },
  sent: { key: "purchases.statusSent", color: "bg-sky-100 text-sky-700" },
  received: { key: "purchases.statusReceived", color: "bg-emerald-100 text-emerald-700" },
};

export default function PurchaseView() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [po, setPo] = useState(null);
  const [settings, setSettings] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [products, setProducts] = useState([]);
  const fileRef = useRef();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState([]);
  const [scanCode, setScanCode] = useState("");
  const [receiving, setReceiving] = useState(false);
  const scanRef = useRef();

  const load = () => fetch(`/api/purchases/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d ? setPo(d) : setNotFound(true)));
  useEffect(() => {
    load();
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) return <div className="text-slate-500">{t("common.notFound")} <Link href="/exoda?tab=purchases" className="text-brand-600">{t("common.returnLink")}</Link></div>;
  if (!po || !settings) return <div className="text-slate-400">{t("common.loading")}</div>;
  const cur = settings.currency || "€";

  const setStatus = async (status) => {
    await fetch(`/api/purchases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };
  const del = async () => {
    if (!confirm(t("purchases.confirmDelete"))) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    router.push("/exoda?tab=purchases");
  };

  const onAttach = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await fetch(`/api/purchases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attachment: { data: reader.result, name: file.name, type: file.type } }) });
      load();
    };
    reader.readAsDataURL(file);
  };
  const removeAttachment = async () => {
    await fetch(`/api/purchases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attachment: null }) });
    load();
  };

  const openReceive = () => {
    setReceiveItems((po.items || []).map((it) => ({ ...it, receivedQty: it.quantity })));
    setReceiveOpen(true);
    setTimeout(() => scanRef.current?.focus(), 50);
  };
  const updateReceiveQty = (idx, qty) => setReceiveItems((prev) => prev.map((it, i) => (i === idx ? { ...it, receivedQty: Math.max(0, Number(qty)) } : it)));
  const onScan = (e) => {
    if (e.key !== "Enter") return;
    const code = scanCode.trim();
    if (!code) return;
    const prod = products.find((p) => p.barcode && p.barcode === code);
    if (prod) {
      setReceiveItems((prev) => prev.map((it) => (it.productId === prod.id ? { ...it, receivedQty: Number(it.receivedQty || 0) + 1 } : it)));
    }
    setScanCode("");
  };
  const confirmReceive = async () => {
    setReceiving(true);
    await fetch(`/api/purchases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "received", items: receiveItems }) });
    setReceiving(false);
    setReceiveOpen(false);
    load();
  };

  const st = STATUS[po.status] || STATUS.draft;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <Link href="/exoda?tab=purchases" className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("purchases.list")}</Link>
        <div className="flex flex-wrap gap-2">
          <select className="input !py-2 max-w-[170px]" value={po.status} onChange={(e) => setStatus(e.target.value)} disabled={po.received}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v.key)}</option>)}
          </select>
          {!po.received && <button onClick={openReceive} className="btn-secondary"><Icon name="box" size={15} /> {t("purchases.markReceived")}</button>}
          <button onClick={() => fileRef.current?.click()} className="btn-secondary"><Icon name="upload" size={15} /> {t("purchases.attachInvoice")}</button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onAttach} />
          <button onClick={() => window.print()} className="btn-secondary" title={t("purchases.print")}><Icon name="printer" size={15} /></button>
          <button onClick={del} className="btn-secondary text-red-600"><Icon name="trash" size={15} /></button>
        </div>
      </div>

      {po.attachment && (
        <div className="card p-3 no-print max-w-3xl mx-auto flex items-center justify-between gap-3">
          <a href={po.attachment.data} download={po.attachment.name} className="text-sm text-brand-700 hover:underline flex items-center gap-2">
            <Icon name="invoice" size={15} /> {po.attachment.name}
          </a>
          <button onClick={removeAttachment} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button>
        </div>
      )}

      {po.received && <div className="card p-3 no-print max-w-3xl mx-auto text-sm text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-2"><Icon name="check" size={15} /> {t("purchases.receivedNote")}</div>}

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
            <div className="text-lg font-bold text-slate-800 uppercase">{t("purchases.poTitle")}</div>
            <div className="text-2xl font-extrabold text-brand-700">{po.number}</div>
            <div className="text-sm text-slate-500 mt-1">{t("invoices.dateLabel", { date: formatDate(po.date) })}</div>
            {po.expectedDate && <div className="text-sm text-slate-500">{t("purchases.expectedDate")}: {formatDate(po.expectedDate)}</div>}
            <span className={`badge mt-2 ${st.color}`}>{t(st.key)}</span>
          </div>
        </div>

        <div className="py-4 border-b border-slate-100">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("purchases.to")}</div>
          {po.supplier ? (
            <div className="text-sm text-slate-700">
              <div className="font-semibold">{po.supplier.name}</div>
              {po.supplier.address && <div>{po.supplier.address}{po.supplier.city ? `, ${po.supplier.city}` : ""}</div>}
              {po.supplier.afm && <div>{t("customers.fieldTaxId")}: {po.supplier.afm}</div>}
              {po.supplier.phone && <div>{t("customers.fieldPhone")}: {po.supplier.phone}</div>}
            </div>
          ) : <div className="text-sm text-slate-600">—</div>}
        </div>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500 text-xs uppercase">
              <th className="py-2 text-left">{t("invoices.colDescription")}</th>
              <th className="py-2 text-right">{t("invoices.colQty")}</th>
              <th className="py-2 text-right">{t("invoices.colPrice")}</th>
              <th className="py-2 text-right">{t("common.vat")}</th>
              <th className="py-2 text-right">{t("purchases.total")}</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">{it.quantity} {it.unit}</td>
                <td className="py-2 text-right">{money(it.unitPrice, cur)}</td>
                <td className="py-2 text-right">{it.vatRate}%</td>
                <td className="py-2 text-right font-medium">{money(computeTotals([it]).total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-5">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t("purchases.net")}</span><span className="font-medium">{money(po.net, cur)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("purchases.vat")}</span><span className="font-medium">{money(po.vat, cur)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-lg font-bold text-slate-800"><span>{t("purchases.total")}</span><span>{money(po.total, cur)}</span></div>
          </div>
        </div>

        {po.notes && <div className="mt-4 text-sm text-slate-600"><b>{t("purchases.notes")}:</b> {po.notes}</div>}
      </div>

      {receiveOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setReceiveOpen(false)}>
          <div className="card p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">{t("purchases.receiveModalTitle")}</h2>
            <p className="text-sm text-slate-500 mb-4">{t("purchases.receiveModalSub")}</p>

            <div className="relative mb-4">
              <Icon name="scan" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={scanRef} className="input pl-9" placeholder={t("purchases.scanPlaceholder")} value={scanCode} onChange={(e) => setScanCode(e.target.value)} onKeyDown={onScan} />
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="table-th">{t("invoices.colDescription")}</th>
                    <th className="table-th text-right">{t("purchases.ordered")}</th>
                    <th className="table-th text-right">{t("purchases.received")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveItems.map((it, idx) => (
                    <tr key={idx}>
                      <td className="table-td">{it.description}</td>
                      <td className="table-td text-right text-slate-400">{it.quantity} {it.unit}</td>
                      <td className="table-td text-right"><input type="number" step="any" min="0" className="input !w-24 !py-1 text-right ml-auto" value={it.receivedQty} onChange={(e) => updateReceiveQty(idx, e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setReceiveOpen(false)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={confirmReceive} disabled={receiving} className="btn-primary">{receiving ? t("common.saving") : t("purchases.confirmReceiveBtn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
