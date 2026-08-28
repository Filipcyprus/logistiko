"use client";

import { useRef, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { money } from "@/lib/format";
import { generateBarcode } from "@/lib/barcode";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { effectiveDiscountTiers } from "@/lib/pricing";

const PRODUCT_TYPES = [
  ["product", "typeProduct"],
  ["service", "typeService"],
  ["cosmetic", "typeCosmetic"],
  ["perfume", "typePerfume"],
  ["equipment", "typeEquipment"],
  ["consumable", "typeConsumable"],
  ["printingMaterial", "typePrinting"],
];

const DEPARTMENTS = [
  ["printShop", "deptPrintShop"],
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
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    fetch("/api/warehouses").then((r) => r.json()).then(setWarehouses);
  }, []);

  // Όταν ο χρήστης επεξεργάζεται ποσότητες ανά τοποθεσία, το συνολικό απόθεμα ενημερώνεται ως το άθροισμα τους.
  // Σκόπιμα ΔΕΝ γίνεται αυτόματος επανυπολογισμός κατά τη φόρτωση — πωλήσεις/παραλαβές αλλάζουν το συνολικό
  // απόθεμα χωρίς να αγγίζουν την ανάλυση ανά τοποθεσία, οπότε ένας τέτοιος συγχρονισμός θα το ξανάγραφε λάθος.
  const applyWarehouseStocks = (newWs) => {
    const total = newWs.reduce((sum, w) => sum + (Number(w.stock) || 0), 0);
    upd({ warehouseStocks: newWs, stock: total });
  };

  const isService = form.productType === "service";
  const showSerial = form.productType === "equipment";
  const showBatchExpiry = form.department === "perfumes";

  const upd = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => upd({ image: reader.result });
    reader.readAsDataURL(file);
  };

  const round2 = (n) => Math.round(n * 100) / 100;
  const cost = Number(form.cost || 0);
  const vatRate = Number(form.vatRate || 0);
  const costWithVat = form.costWithVat !== undefined ? form.costWithVat : (form.cost === "" ? "" : round2(cost * (1 + vatRate / 100)));
  const wholesale = Number(form.wholesalePrice || 0);
  const shippingRate = form.shippingRate === "" || form.shippingRate == null ? 2.4 : Number(form.shippingRate);
  const shippingCostWithVat = round2((Number(form.weightG || 0) / 1000) * shippingRate);
  const shippingCost = round2(shippingCostWithVat / (1 + vatRate / 100));
  const totalCostWithVat = round2(Number(costWithVat || 0) + shippingCostWithVat);
  const saleVatRate = Number(form.saleVatRate ?? 19);
  const wholesaleNet = wholesale > 0 ? round2(wholesale / (1 + saleVatRate / 100)) : 0;
  const wholesaleProfit = wholesaleNet - totalCostWithVat;
  const wholesaleMargin = wholesaleNet > 0 ? (wholesaleProfit / wholesaleNet) * 100 : 0;

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
            <label className="label">{t("stock.fieldBarcode")}</label>
            <div className="flex gap-2">
              <input className="input" value={form.barcode} onChange={(e) => upd({ barcode: e.target.value })} />
              <button type="button" onClick={() => upd({ barcode: generateBarcode() })} className="btn-secondary whitespace-nowrap" title={t("stock.generateBarcode")}>
                <Icon name="scan" size={15} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">{t("stock.fieldSku")}</label>
            <input className="input" value={form.sku || ""} onChange={(e) => upd({ sku: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("stock.fieldHsCode")}</label>
            <input className="input" value={form.hsCode || ""} onChange={(e) => upd({ hsCode: e.target.value })} />
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
            <label className="label">{t("stock.fieldTargetProfessions")}</label>
            <div className="space-y-2">
              {["Barber", "Print", "Perfumes"].map((prof) => (
                <label key={prof} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(form.targetProfessions || []).includes(prof)} onChange={(e) => {
                    const profs = form.targetProfessions || [];
                    upd({ targetProfessions: e.target.checked ? [...profs, prof] : profs.filter((p) => p !== prof) });
                  }} className="rounded" />
                  <span className="text-sm">{prof}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("stock.fieldImage")}</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                {form.image ? <img src={form.image} alt="" className="w-full h-full object-contain" /> : <Icon name="image" size={26} className="text-slate-300" />}
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
      <div className="card p-6 space-y-5">
        <SectionHeader icon="money" title={t("stock.sectionPricing")} />

        {/* Τι χρεώνεις τον πελάτη — μπαίνει ΠΡΩΤΟ και ξεχωριστά από το κόστος, ώστε να μη γράφεται
            κατά λάθος η τιμή πώλησης στο πεδίο Κόστος παρακάτω (έχει ξαναγίνει επανειλημμένα). */}
        <div>
          <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">{t("stock.chargeSectionTitle")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("stock.fieldWholesalePrice")}</label>
              <input type="number" step="any" className="input" value={form.wholesalePrice} onChange={(e) => upd({ wholesalePrice: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("stock.fieldRetailPrice")}</label>
              <input type="number" step="any" className="input" value={form.retailPrice ?? ""} onChange={(e) => upd({ retailPrice: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("stock.fieldSalesVat")}</label>
              <select className="input" value={form.saleVatRate ?? 19} onChange={(e) => upd({ saleVatRate: Number(e.target.value) })}>
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={9}>9%</option>
                <option value={19}>19%</option>
              </select>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide">{t("stock.profitWholesaleLabel")}</div>
              <div className={`text-lg font-semibold ${wholesaleProfit < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(wholesaleProfit, cur)} <span className="text-sm font-medium">({wholesaleMargin.toFixed(1)}%)</span></div>
            </div>
          </div>
        </div>

        {/* Τι πλήρωσες εσύ στον προμηθευτή — ξεχωριστό block, σκόπιμα ΜΕΤΑ την τιμή πώλησης. */}
        <div className="pt-1 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-3">{t("stock.costSectionTitle")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("stock.fieldCostWithVat")}</label>
              <input
                type="number"
                step="any"
                className="input"
                value={costWithVat === "" ? "" : costWithVat}
                onChange={(e) => {
                  const gross = e.target.value;
                  upd({
                    costWithVat: gross === "" ? "" : gross,
                    cost: gross === "" ? "" : round2(Number(gross) / (1 + vatRate / 100))
                  });
                }}
              />
            </div>
            <div>
              <label className="label">{t("stock.fieldCost")}</label>
              <input type="number" step="any" className="input" value={form.cost} onChange={(e) => upd({ cost: e.target.value, costWithVat: undefined })} placeholder={t("stock.fieldCostOptional")} />
            </div>
            <div>
              <label className="label">{t("stock.fieldCostVat")}</label>
              <select className="input" value={form.vatRate ?? 0} onChange={(e) => upd({ vatRate: Number(e.target.value) })}>
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={9}>9%</option>
                <option value={19}>19%</option>
              </select>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide">{t("stock.totalCostLabel")}</div>
              <div className="text-lg font-semibold text-slate-700">{money(totalCostWithVat, cur)}</div>
            </div>
          </div>
        </div>

        {(form.productType === "cosmetic" || form.productType === "consumable" || (form.customDiscountTiers || []).length > 0) && (
          <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
            <div className="text-xs font-semibold text-brand-800 uppercase tracking-wide mb-2">{t("stock.qtyDiscountTitle")}{(form.customDiscountTiers || []).length > 0 ? ` (${t("stock.customDiscountBadge")})` : ""}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-500">{t("stock.qtyTierBase")}</div>
                <div className="font-semibold text-slate-700">{money(wholesale, cur)}</div>
              </div>
              {effectiveDiscountTiers(form, settings?.quantityDiscounts).map((tier, i) => (
                <div key={i}>
                  <div className="text-slate-500">{tier.min}+ ({tier.percent}%)</div>
                  <div className="font-semibold text-emerald-700">{money(round2(wholesale * (1 - tier.percent / 100)), cur)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-semibold text-slate-700 text-sm">{t("stock.customDiscountTitle")}</label>
              <p className="text-xs text-slate-500 mt-0.5">{t("stock.customDiscountDesc")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const tiers = form.customDiscountTiers || [];
                upd({ customDiscountTiers: [...tiers, { min: 0, percent: 0 }] });
              }}
              className="btn-secondary text-sm flex items-center gap-1 whitespace-nowrap"
            >
              <Icon name="plus" size={14} /> Add
            </button>
          </div>

          {(form.customDiscountTiers || []).length > 0 && (
            <div className="space-y-2">
              {form.customDiscountTiers.map((tier, idx) => (
                <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded-lg">
                  <div className="flex-1">
                    <label className="label">{t("settings.qtyDiscountMinLabel")}</label>
                    <input
                      type="number" step="1" min="0" className="input"
                      value={tier.min}
                      onChange={(e) => {
                        const newTiers = [...form.customDiscountTiers];
                        newTiers[idx] = { ...newTiers[idx], min: Number(e.target.value) };
                        upd({ customDiscountTiers: newTiers });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="label">{t("settings.qtyDiscountPercentLabel")}</label>
                    <input
                      type="number" step="any" min="0" max="100" className="input"
                      value={tier.percent}
                      onChange={(e) => {
                        const newTiers = [...form.customDiscountTiers];
                        newTiers[idx] = { ...newTiers[idx], percent: Number(e.target.value) };
                        upd({ customDiscountTiers: newTiers });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => upd({ customDiscountTiers: form.customDiscountTiers.filter((_, i) => i !== idx) })}
                    className="btn-ghost text-red-600"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* INVENTORY */}
      {!isService && (
        <div className="card p-6 space-y-4">
          <SectionHeader icon="box" title={t("stock.sectionInventory")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{form.id ? t("stock.fieldStock") : t("stock.fieldInitialStock")}</label>
              <input
                type="number" step="any" className="input"
                value={form.stock}
                disabled={(form.warehouseStocks || []).length > 0}
                onChange={(e) => upd({ stock: e.target.value })}
              />
              {(form.warehouseStocks || []).length > 0 && (
                <p className="text-xs text-slate-400 mt-1">{t("stock.stockAutoSummed")}</p>
              )}
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
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">{t("stock.fieldWarehouses")}</label>
              <button
                type="button"
                onClick={() => {
                  const ws = form.warehouseStocks || [];
                  upd({ warehouseStocks: [...ws, { location: "", stock: 0, binLocation: "", expiryDate: "" }] });
                }}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Icon name="plus" size={14} /> Add
              </button>
            </div>

            <div className="space-y-3">
              {(form.warehouseStocks || []).map((ws, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder={t("stock.warehouseName")}
                        value={ws.location}
                        onChange={(e) => {
                          const newWs = [...form.warehouseStocks];
                          newWs[idx].location = e.target.value;
                          upd({ warehouseStocks: newWs });
                        }}
                        className="input text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="number"
                        step="any"
                        placeholder={t("stock.fieldStock")}
                        value={ws.stock}
                        onChange={(e) => {
                          const newWs = [...form.warehouseStocks];
                          newWs[idx] = { ...newWs[idx], stock: e.target.value };
                          applyWarehouseStocks(newWs);
                        }}
                        className="input text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder={t("stock.fieldBinLocation")}
                        value={ws.binLocation}
                        onChange={(e) => {
                          const newWs = [...form.warehouseStocks];
                          newWs[idx].binLocation = e.target.value;
                          upd({ warehouseStocks: newWs });
                        }}
                        className="input text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newWs = form.warehouseStocks.filter((_, i) => i !== idx);
                        applyWarehouseStocks(newWs);
                      }}
                      className="btn-ghost text-red-600 text-sm whitespace-nowrap"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  {form.department === "perfumes" && form.trackExpiry && (
                    <div>
                      <input
                        type="date"
                        placeholder={t("stock.fieldExpiryDate")}
                        value={ws.expiryDate || ""}
                        onChange={(e) => {
                          const newWs = [...form.warehouseStocks];
                          newWs[idx].expiryDate = e.target.value;
                          upd({ warehouseStocks: newWs });
                        }}
                        className="input text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
              {(!form.warehouseStocks || form.warehouseStocks.length === 0) && (
                <p className="text-sm text-slate-500 italic">{t("stock.noWarehouses")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHIPPING */}
      {!isService && (
        <div className="card p-6 space-y-4">
          <SectionHeader icon="truck" title={t("stock.sectionShipping")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("stock.fieldVolumeMl")}</label>
              <input
                type="number"
                step="any"
                className="input"
                value={form.volumeMl ?? ""}
                onChange={(e) => {
                  const ml = e.target.value;
                  upd({ volumeMl: ml, weightG: ml === "" ? form.weightG : ml });
                }}
              />
            </div>
            <div>
              <label className="label">{t("stock.fieldWeightG")}</label>
              <input type="number" step="any" className="input" value={form.weightG ?? ""} onChange={(e) => upd({ weightG: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("stock.fieldShippingRate")}</label>
              <input type="number" step="any" className="input" value={form.shippingRate ?? 2.4} onChange={(e) => upd({ shippingRate: e.target.value })} />
            </div>
            <div />
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide">{t("stock.shippingCostLabel")}</div>
              <div className="text-lg font-semibold text-slate-700">{money(shippingCost, cur)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide">{t("stock.shippingCostWithVatLabel")}</div>
              <div className="text-lg font-semibold text-slate-700">{money(shippingCostWithVat, cur)}</div>
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

          {showSerial && form.trackSerial && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 text-sm">{t("stock.fieldSerialNumbers")}</label>
                <button
                  type="button"
                  onClick={() => {
                    const serials = form.serialNumbers || [];
                    upd({ serialNumbers: [...serials, ""] });
                  }}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <Icon name="plus" size={14} /> Add
                </button>
              </div>

              <div className="space-y-2">
                {(form.serialNumbers || []).map((serial, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder={t("stock.serialNumberPlaceholder")}
                      value={serial}
                      onChange={(e) => {
                        const newSerials = [...form.serialNumbers];
                        newSerials[idx] = e.target.value;
                        upd({ serialNumbers: newSerials });
                      }}
                      className="input text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSerials = form.serialNumbers.filter((_, i) => i !== idx);
                        upd({ serialNumbers: newSerials });
                      }}
                      className="btn-ghost text-red-600 text-sm"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                {(!form.serialNumbers || form.serialNumbers.length === 0) && (
                  <p className="text-sm text-slate-500 italic">{t("stock.noSerialNumbers")}</p>
                )}
              </div>
            </div>
          )}
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
