"use client";

import { useRef } from "react";
import Icon from "@/components/Icon";
import { money } from "@/lib/format";
import { generateBarcode } from "@/lib/barcode";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const PRODUCT_TYPES = [
  ["product", "typeProduct"],
  ["service", "typeService"],
  ["cosmetic", "typeCosmetic"],
  ["perfume", "typePerfume"],
  ["equipment", "typeEquipment"],
  ["printingMaterial", "typePrinting"],
];

const DEPARTMENTS = [
  ["printShop", "deptPrintShop"],
  ["kiosk", "deptKiosk"],
  ["barber", "deptBarber"],
  ["perfumes", "deptPerfumes"],
];

function unitSuggestions(productType, t) {
  if (productType === "printingMaterial") {
    return [t("stock.unitSheet"), t("stock.unitRoll"), t("stock.unitPack"), t("stock.unitReam"), t("stock.unitPcs")];
  }
  if (productType === "cosmetic" || productType === "perfume") {
    return [t("stock.unitBottle"), t("stock.unitLiter"), t("stock.unitPcs"), t("stock.unitBox")];
  }
  return [t("stock.unitPcs"), t("stock.unitBox"), t("stock.unitKg"), t("stock.unitLiter")];
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
        <Icon name={icon} size={16} />
      </div>
      <h2 className="font-semibold text-slate-700">{title}</h2>
    </div>
  );
}

export default function ProductForm({ form, setForm, categories = [], suppliers = [], settings, catListId = "cat-list-form" }) {
  const { t } = useLanguage();
  const imgRef = useRef();
  const cur = settings?.currency || "€";

  const isService = form.productType === "service";
  const showSerial = form.productType === "equipment";
  const showBatchExpiry = form.productType === "cosmetic" || form.productType === "perfume";

  const upd = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => upd({ image: reader.result });
    reader.readAsDataURL(file);
  };

  const cost = Number(form.cost || 0);
  const wholesale = Number(form.wholesalePrice || 0);
  const profit = wholesale - cost;
  const margin = wholesale > 0 ? (profit / wholesale) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* GENERAL */}
      <div className="card p-6 space-y-4">
        <SectionHeader icon="tag" title={t("stock.sectionGeneral")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">{t("stock.fieldName")}</label>
            <input className="input" value={form.name} onChange={(e) => upd({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldCode")}</label>
            <input className="input" value={form.code} onChange={(e) => upd({ code: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldBarcode")}</label>
            <div className="flex gap-2">
              <input className="input" value={form.barcode} onChange={(e) => upd({ barcode: e.target.value })} />
              <button type="button" onClick={() => upd({ barcode: generateBarcode() })} className="btn-secondary whitespace-nowrap" title={t("stock.generateBarcode")}>
                <Icon name="scan" size={15} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">{t("stock.fieldBrand")}</label>
            <input className="input" value={form.brand} onChange={(e) => upd({ brand: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldCategory")}</label>
            <input className="input" list={catListId} value={form.category} onChange={(e) => upd({ category: e.target.value })} placeholder={t("stock.categoryPlaceholder")} />
            <datalist id={catListId}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="label">{t("stock.fieldSupplier")}</label>
            <select className="input" value={form.supplierId || ""} onChange={(e) => upd({ supplierId: e.target.value })}>
              <option value="">{t("stock.noSupplier")}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("stock.fieldDepartment")}</label>
            <select className="input" value={form.department || ""} onChange={(e) => upd({ department: e.target.value })}>
              <option value="">{t("stock.allDepartments")}</option>
              {DEPARTMENTS.map(([d, key]) => <option key={d} value={d}>{t(`stock.${key}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("stock.fieldProductType")}</label>
            <select className="input" value={form.productType} onChange={(e) => upd({ productType: e.target.value })}>
              {PRODUCT_TYPES.map(([pt, key]) => <option key={pt} value={pt}>{t(`stock.${key}`)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("stock.fieldImage")}</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : <Icon name="image" size={26} className="text-slate-300" />}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => imgRef.current?.click()} className="btn-secondary">{t("stock.uploadImage")}</button>
                {form.image && <button type="button" onClick={() => upd({ image: "" })} className="btn-ghost text-red-600">{t("stock.removeImage")}</button>}
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onImage} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="card p-6 space-y-4">
        <SectionHeader icon="money" title={t("stock.sectionPricing")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("stock.fieldCost")}</label>
            <input type="number" step="any" className="input" value={form.cost} onChange={(e) => upd({ cost: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldVat")}</label>
            <input type="number" step="any" className="input" value={form.vatRate} onChange={(e) => upd({ vatRate: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldWholesalePrice")}</label>
            <input type="number" step="any" className="input" value={form.wholesalePrice} onChange={(e) => upd({ wholesalePrice: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldRetailPrice")}</label>
            <input type="number" step="any" className="input" value={form.retailPrice ?? ""} onChange={(e) => upd({ retailPrice: e.target.value })} />
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">{t("stock.profitLabel")}</div>
            <div className={`text-lg font-semibold ${profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(profit, cur)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">{t("stock.marginLabel")}</div>
            <div className={`text-lg font-semibold ${margin < 0 ? "text-red-600" : "text-emerald-700"}`}>{margin.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* INVENTORY */}
      {!isService && (
        <div className="card p-6 space-y-4">
          <SectionHeader icon="box" title={t("stock.sectionInventory")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{form.id ? t("stock.fieldStock") : t("stock.fieldInitialStock")}</label>
              <input type="number" step="any" className="input" value={form.stock} onChange={(e) => upd({ stock: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("stock.fieldUnit")}</label>
              <input className="input" list="unit-list-form" value={form.unit} onChange={(e) => upd({ unit: e.target.value })} placeholder={t("stock.unitPlaceholder")} />
              <datalist id="unit-list-form">{unitSuggestions(form.productType, t).map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <div>
              <label className="label">{t("stock.fieldLowStock")}</label>
              <input type="number" step="any" className="input" value={form.lowStock} onChange={(e) => upd({ lowStock: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("stock.availableStock")}</label>
              <input className="input bg-slate-50 text-slate-500" value={form.stock} disabled />
            </div>
            <div>
              <label className="label">{t("stock.fieldWarehouse")}</label>
              <input className="input" value={form.warehouse} onChange={(e) => upd({ warehouse: e.target.value })} placeholder={t("stock.warehousePlaceholder")} />
            </div>
            <div>
              <label className="label">{t("stock.fieldBinLocation")}</label>
              <input className="input" value={form.binLocation} onChange={(e) => upd({ binLocation: e.target.value })} placeholder={t("stock.binPlaceholder")} />
            </div>
          </div>
        </div>
      )}

      {/* TRACKING */}
      {!isService && (
        <div className="card p-6 space-y-3">
          <SectionHeader icon="layers" title={t("stock.sectionTracking")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.trackStock !== false} onChange={(e) => upd({ trackStock: e.target.checked })} /> {t("stock.trackStockLabel")}</label>
            {showSerial && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.trackSerial} onChange={(e) => upd({ trackSerial: e.target.checked })} /> {t("stock.trackSerialLabel")}</label>
            )}
            {showBatchExpiry && (
              <>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.trackBatch} onChange={(e) => upd({ trackBatch: e.target.checked })} /> {t("stock.trackBatchLabel")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.trackExpiry} onChange={(e) => upd({ trackExpiry: e.target.checked })} /> {t("stock.trackExpiryLabel")}</label>
              </>
            )}
          </div>
        </div>
      )}

      {/* NOTES */}
      <div className="card p-6 space-y-3">
        <SectionHeader icon="note" title={t("stock.sectionNotes")} />
        <textarea className="input min-h-[90px]" value={form.notes} onChange={(e) => upd({ notes: e.target.value })} placeholder={t("stock.notesPlaceholder")} />
      </div>
    </div>
  );
}
