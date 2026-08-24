"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const UNASSIGNED = "__unassigned__";

export default function ReorderListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [unassignedSupplierId, setUnassignedSupplierId] = useState("");
  const [creating, setCreating] = useState(null); // supplierId currently being checked out

  const load = () => fetch("/api/reorder-list").then((r) => r.json()).then(setItems);
  useEffect(() => {
    load();
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const cur = settings?.currency || "€";

  const updateQty = async (id, quantity) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity } : it)));
    await fetch(`/api/reorder-list/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }) });
  };
  const removeItem = async (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/reorder-list/${id}`, { method: "DELETE" });
  };

  // Ομαδοποίηση ανά προμηθευτή του προϊόντος — ό,τι δεν έχει ορισμένο (ή διαγραμμένο) προϊόν
  // πάει στην ομάδα "χωρίς προμηθευτή", όπου ο χρήστης διαλέγει έναν πριν τη δημιουργία παραγγελίας.
  const groups = {};
  for (const it of items) {
    const p = products.find((x) => x.id === it.productId);
    const supplierId = p?.supplierId || UNASSIGNED;
    if (!groups[supplierId]) groups[supplierId] = [];
    groups[supplierId].push({ ...it, product: p });
  }

  const createPO = async (supplierId, groupItems) => {
    const finalSupplierId = supplierId === UNASSIGNED ? unassignedSupplierId : supplierId;
    if (!finalSupplierId) { alert(t("purchases.supplierPlaceholder")); return; }
    setCreating(supplierId);
    const poItems = groupItems.map((it) => ({
      productId: it.productId,
      description: it.product?.name || it.productName,
      quantity: Number(it.quantity),
      unit: it.product?.unit || it.unit,
      unitPrice: Number(it.product?.cost || 0),
      vatRate: Number(it.product?.vatRate || 0),
      discount: 0,
    }));
    const res = await fetch("/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId: finalSupplierId, items: poItems }) });
    if (res.ok) {
      const po = await res.json();
      await Promise.all(groupItems.map((it) => fetch(`/api/reorder-list/${it.id}`, { method: "DELETE" })));
      router.push(`/agores/${po.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ? t(err.error) : t("common.error"));
      setCreating(null);
    }
  };

  const groupTotal = (groupItems) => groupItems.reduce((sum, it) => sum + Number(it.quantity) * Number(it.product?.cost || 0), 0);

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("stock.reorderList")}</h1>
          <p className="text-slate-500 text-sm">{t("stock.reorderListSub")}</p>
        </div>
        <Link href="/apothiki" className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("stock.backToList")}</Link>
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">{t("stock.reorderListEmpty")}</div>
      ) : (
        Object.entries(groups).map(([supplierId, groupItems]) => {
          const supplier = suppliers.find((s) => s.id === supplierId);
          return (
            <div key={supplierId} className="card p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-semibold text-slate-800">
                  {supplierId === UNASSIGNED ? t("stock.reorderNoSupplier") : supplier?.name || "—"}
                </div>
                {supplierId === UNASSIGNED && (
                  <select className="input !py-1.5 max-w-[220px]" value={unassignedSupplierId} onChange={(e) => setUnassignedSupplierId(e.target.value)}>
                    <option value="">{t("purchases.supplierPlaceholder")}</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {groupItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{it.product?.name || it.productName}</div>
                      {!it.product && <div className="text-xs text-red-500">{t("stock.reorderProductDeleted")}</div>}
                    </div>
                    <input
                      type="number" step="any" min="0"
                      className="input !py-1 w-24 text-right"
                      value={it.quantity}
                      onChange={(e) => updateQty(it.id, e.target.value)}
                    />
                    <span className="text-sm text-slate-500 w-14">{it.product?.unit || it.unit}</span>
                    <button onClick={() => removeItem(it.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="x" size={14} /></button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-sm text-slate-500">{t("purchases.total")}: <span className="font-semibold text-slate-800">{money(groupTotal(groupItems), cur)}</span></div>
                <button onClick={() => createPO(supplierId, groupItems)} disabled={creating === supplierId} className="btn-primary">
                  <Icon name="invoice" size={15} /> {creating === supplierId ? t("common.saving") : t("stock.createPOFromList")}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
