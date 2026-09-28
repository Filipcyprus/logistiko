"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, money } from "@/lib/format";
import Icon from "@/components/Icon";
import ProductPicker from "@/components/ProductPicker";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ConsignmentDeliveryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [perfumes, setPerfumes] = useState([]);

  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    fetch(`/api/consignment-deliveries/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d ? setData(d) : setNotFound(true)));
  };
  useEffect(() => {
    load();
    fetch("/api/products").then((r) => r.json()).then((list) => setPerfumes(list.filter((p) => p.department === "perfumes")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) return (
    <div className="text-slate-500">
      {t("common.notFound")} <Link href="/consignment" className="text-brand-600">{t("common.returnLink")}</Link>
    </div>
  );
  if (!data) return <div className="text-slate-400">{t("common.loading")}</div>;

  const { delivery, store, company } = data;

  const startEdit = () => {
    setErr("");
    setEditItems(delivery.items.map((it) => ({ productId: it.productId, quantity: it.quantity, price: it.unitPrice ?? "" })));
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setErr(""); };

  const updateLine = (idx, patch) => setEditItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx) => setEditItems((prev) => prev.filter((_, i) => i !== idx));
  const addLine = () => setEditItems((prev) => [...prev, { productId: "", quantity: 1, price: "" }]);

  const saveEdit = async () => {
    setErr("");
    const items = editItems.filter((l) => l.productId && Number(l.quantity) > 0).map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: l.price !== "" ? Number(l.price) : undefined }));
    if (items.length === 0) { setErr(t("consignment.errSendFields")); return; }
    setSaving(true);
    const res = await fetch(`/api/consignment-deliveries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    setSaving(false);
    if (res.ok) { setEditing(false); load(); }
    else { const e = await res.json().catch(() => ({})); setErr(e.error ? t(e.error) : t("common.error")); }
  };

  const doDelete = async () => {
    if (!confirm(t("consignment.confirmDeleteDelivery"))) return;
    setSaving(true);
    const res = await fetch(`/api/consignment-deliveries/${id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) router.push("/consignment");
    else { const e = await res.json().catch(() => ({})); setErr(e.error ? t(e.error) : t("common.error")); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <button onClick={() => router.push("/consignment")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("consignment.title")}</button>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button onClick={startEdit} className="btn-secondary"><Icon name="edit" size={15} /> {t("consignment.editDelivery")}</button>
              <button onClick={doDelete} disabled={saving} className="btn-secondary text-red-600"><Icon name="trash" size={15} /> {t("consignment.deleteDelivery")}</button>
              <button onClick={() => window.print()} className="btn-primary"><Icon name="printer" size={15} /> {t("common.print")}</button>
            </>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit} disabled={saving} className="btn-secondary"><Icon name="x" size={15} /> {t("common.cancel")}</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary"><Icon name="check" size={15} /> {saving ? t("common.saving") : t("common.save")}</button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="card p-5 space-y-3 no-print max-w-3xl mx-auto">
          <p className="text-sm text-slate-500">{t("consignment.editDeliveryHint")}</p>
          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
          <div className="space-y-2">
            {editItems.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="label">{t("consignment.fieldProduct")}</label>
                  <ProductPicker
                    products={perfumes}
                    value={line.productId}
                    onChange={(pid) => {
                      const p = perfumes.find((x) => x.id === pid);
                      updateLine(idx, { productId: pid, price: p ? (Number(p.retailPrice) || 0) : "" });
                    }}
                    formatOption={(p) => `${p.name} (${t("consignment.warehouseStock")}: ${p.stock})`}
                  />
                </div>
                <div className="w-24">
                  <label className="label">{t("consignment.fieldQuantity")}</label>
                  <input type="number" min="1" step="any" className="input" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                </div>
                <div className="w-28">
                  <label className="label">{t("consignment.fieldPrice")}</label>
                  <input type="number" min="0" step="any" className="input" value={line.price} onChange={(e) => updateLine(idx, { price: e.target.value })} placeholder={t("consignment.fieldPricePlaceholder")} />
                </div>
                <button onClick={() => removeLine(idx)} disabled={editItems.length === 1} className="btn-ghost !px-2 !py-2 text-red-500 disabled:opacity-30"><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={addLine} className="btn-secondary"><Icon name="plus" size={15} /> {t("consignment.addLine")}</button>
        </div>
      )}

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
              <th className="py-2 text-right">{t("consignment.colPrice")}</th>
              <th className="py-2 text-right">{t("consignment.colTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {delivery.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{it.productName}</td>
                <td className="py-2 text-right">{it.quantity} {it.unit}</td>
                <td className="py-2 text-right">{it.unitPrice ? money(it.unitPrice, company.currency) : "—"}</td>
                <td className="py-2 text-right">{it.unitPrice ? money(it.unitPrice * it.quantity, company.currency) : "—"}</td>
              </tr>
            ))}
          </tbody>
          {delivery.items.some((it) => it.unitPrice) && (
            <tfoot>
              <tr className="border-t border-slate-300 font-semibold text-slate-800">
                <td className="py-2" colSpan={3}>{t("consignment.deliveryTotalValue")}</td>
                <td className="py-2 text-right">{money(delivery.items.reduce((sum, it) => sum + (it.unitPrice || 0) * it.quantity, 0), company.currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        <p className="text-xs text-slate-400 mt-1">{t("consignment.deliveryPriceHint")}</p>

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
