"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import ProductForm from "@/components/ProductForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const emptyP = {
  name: "", code: "", barcode: "", brand: "", category: "", supplierId: "", productType: "product", image: "",
  cost: 0, wholesalePrice: 0, retailPrice: "", vatRate: 19,
  stock: 0, unit: "pcs", lowStock: 0, warehouse: "", binLocation: "",
  trackStock: true, trackSerial: false, trackBatch: false, trackExpiry: false,
  notes: "",
};

export default function NewProductPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([s, cats, sup, prods]) => {
      setSettings(s); setSuppliers(sup);
      setCategories(Array.from(new Set([...cats.map((c) => c.name), ...prods.map((p) => p.category).filter(Boolean)])).sort());
      setForm({ ...emptyP, unit: t("common.unit"), vatRate: s.vatRate ?? 19 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!form.name.trim()) { alert(t("stock.errNeedName")); return; }
    setSaving(true);
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      const cat = (form.category || "").trim();
      if (cat && !categories.includes(cat)) {
        await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cat }) });
      }
      router.push("/apothiki");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ? t(err.error) : t("common.error"));
      setSaving(false);
    }
  };

  if (!form || !settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t("stock.newItemTitle")}</h1>
        <button onClick={() => router.push("/apothiki")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("stock.backToList")}</button>
      </div>

      <ProductForm form={form} setForm={setForm} categories={categories} suppliers={suppliers} settings={settings} />

      <div className="flex justify-end gap-2">
        <button onClick={() => router.push("/apothiki")} className="btn-secondary">{t("common.cancel")}</button>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </div>
  );
}
