"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import ProductForm from "@/components/ProductForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function EditProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch(`/api/products/${id}`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([s, cats, sup, prods, p]) => {
      if (!p) { setNotFound(true); return; }
      setSettings(s); setSuppliers(sup);
      setCategories(Array.from(new Set([...cats.map((c) => c.name), ...prods.map((x) => x.category).filter(Boolean)])).sort());
      setForm({ ...p, retailPrice: p.retailPrice ?? "" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!form.name.trim()) { alert(t("stock.errNeedName")); return; }
    setSaving(true);
    const res = await fetch(`/api/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
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

  if (notFound) return <div className="text-slate-500">{t("common.notFound")} <Link href="/apothiki" className="text-brand-600">{t("common.returnLink")}</Link></div>;
  if (!form || !settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t("stock.editItemTitle")}</h1>
        <button onClick={() => router.push("/apothiki")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("stock.backToList")}</button>
      </div>

      <ProductForm form={form} setForm={setForm} categories={categories} suppliers={suppliers} settings={settings} catListId="cat-list-edit" />

      <div className="flex justify-end gap-2">
        <button onClick={() => router.push("/apothiki")} className="btn-secondary">{t("common.cancel")}</button>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </div>
  );
}
