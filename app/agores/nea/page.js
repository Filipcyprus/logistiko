"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { todayISO } from "@/lib/format";
import LineItems, { emptyLine } from "@/components/LineItems";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NewPurchasePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [date, setDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfNote, setPdfNote] = useState("");
  const pdfInputRef = useRef();

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([s, sup, p]) => {
      setSettings(s); setSuppliers(sup); setProducts(p);
      setItems([emptyLine(s.vatRate ?? 19, t("common.unit"))]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Παραγγελίες αγοράς δεν έχουν τιμές — μόνο ποια προϊόντα/ποσότητες θέλουμε να παραγγείλουμε.
  // Το πραγματικό κόστος καταχωρείται χειροκίνητα ως Έξοδο όταν φτάσει το τιμολόγιο του προμηθευτή.
  const onPdfSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPdfNote("");
    setPdfParsing(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/purchases/parse-pdf", { method: "POST", body: formData });
    setPdfParsing(false);
    if (!res.ok) { setPdfNote(t("purchases.pdfParseError")); return; }
    const { items: extracted, source } = await res.json();
    if (!extracted || extracted.length === 0) { setPdfNote(t("purchases.pdfParseEmpty")); return; }

    const normalizeName = (s) => (s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/['".,\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const findByName = (description) => {
      const normDesc = normalizeName(description);
      if (!normDesc) return null;
      const exact = products.find((p) => normalizeName(p.name) === normDesc);
      if (exact) return exact;
      if (normDesc.length < 8) return null;
      return products.find((p) => {
        const normName = normalizeName(p.name);
        return normName.length >= 8 && (normDesc.includes(normName) || normName.includes(normDesc));
      }) || null;
    };

    let matchedCount = 0;
    const newLines = extracted.map((it) => {
      const byCode = it.barcode ? products.find((p) =>
        (p.barcode && p.barcode === it.barcode) ||
        (p.sku && p.sku === it.barcode) ||
        (p.hsCode && p.hsCode === it.barcode)
      ) : null;
      const matched = byCode || findByName(it.description);
      if (matched) matchedCount++;
      return {
        productId: matched ? matched.id : null,
        description: matched ? matched.name : it.description,
        quantity: it.quantity,
        unit: matched ? matched.unit : t("common.unit"),
      };
    });
    setItems((prev) => {
      const nonEmpty = prev.filter((l) => l.description);
      return [...nonEmpty, ...newLines];
    });
    const baseKey = source === "table" ? "purchases.pdfParseSuccessTable" : "purchases.pdfParseSuccessText";
    const note = t(baseKey, { count: extracted.length });
    setPdfNote(matchedCount > 0 ? `${note} ${t("purchases.pdfParseMatched", { count: matchedCount })}` : note);
  };

  const save = async () => {
    const valid = items.filter((it) => it.description && Number(it.quantity) > 0);
    if (valid.length === 0) { alert(t("purchases.errNeedLine")); return; }
    if (!supplierId) { alert(t("errors.missingSupplier")); return; }
    setSaving(true);
    const res = await fetch("/api/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, expectedDate, supplierId, notes, items: valid }) });
    if (res.ok) { const doc = await res.json(); router.push(`/agores/${doc.id}`); }
    else { const err = await res.json().catch(() => ({})); alert(err.error ? t(err.error) : t("common.error")); setSaving(false); }
  };

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t("purchases.newPOTitle")}</h1>
        <div className="flex items-center gap-2">
          <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onPdfSelected} />
          <button onClick={() => pdfInputRef.current?.click()} disabled={pdfParsing} className="btn-secondary">
            <Icon name="upload" size={15} /> {pdfParsing ? t("common.loading") : t("purchases.uploadPdf")}
          </button>
          <button onClick={() => router.push("/exoda?tab=purchases")} className="btn-secondary"><Icon name="arrowLeft" size={15} /> {t("purchases.back")}</button>
        </div>
      </div>

      {pdfNote && <div className="text-sm rounded-lg px-3 py-2 bg-brand-50 text-brand-700">{pdfNote}</div>}

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">{t("purchases.supplier")} <span className="text-red-500">*</span></label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t("purchases.supplierPlaceholder")}</option>
            {suppliers.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("purchases.date")}</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("purchases.expectedDate")}</label>
          <input type="date" className="input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
      </div>

      <LineItems items={items} onChange={setItems} products={products} defaultVat={settings.vatRate ?? 19} pricing={false} />

      <div className="card p-5">
        <label className="label">{t("purchases.notes")}</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? t("common.saving") : t("purchases.save")}</button>
      </div>
    </div>
  );
}
