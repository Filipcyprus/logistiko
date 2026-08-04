"use client";

import { useState } from "react";
import { money, computeTotals } from "@/lib/format";
import { quantityDiscountPercentForProduct } from "@/lib/pricing";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function emptyLine(vatRate = 19, unit = "pcs") {
  return { productId: null, description: "", quantity: 1, unit, unitPrice: 0, vatRate, discount: 0 };
}

export default function LineItems({ items, onChange, products = [], currency = "€", defaultVat = 24, discountTiers }) {
  const { t } = useLanguage();
  // Αναζήτηση ανά γραμμή: κείμενο που πληκτρολογείται (query) και ποια γραμμή έχει
  // ανοιχτή τη λίστα προτάσεων (openIdx) — αντικαθιστά το select που απαιτούσε scroll.
  const [query, setQuery] = useState({});
  const [openIdx, setOpenIdx] = useState(null);

  const setLine = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addLine = () => onChange([...items, emptyLine(defaultVat, t("common.unit"))]);
  const removeLine = (idx) => onChange(items.filter((_, i) => i !== idx));

  const pickProduct = (idx, productId) => {
    if (!productId) return setLine(idx, { productId: null });
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    // If Retail Price is set, use it (VAT already included). Otherwise use Wholesale Price + VAT
    const unitPrice = p.retailPrice && p.retailPrice > 0 ? p.retailPrice : p.price;
    const vatRate = p.retailPrice && p.retailPrice > 0 ? 0 : (p.saleVatRate != null ? p.saleVatRate : 19);
    const patch = { productId: p.id, description: p.name, unit: p.unit, unitPrice, vatRate };
    const hasDiscount = ["cosmetic", "consumable"].includes(p.productType) || (p.customDiscountTiers || []).length > 0;
    if (hasDiscount) patch.discount = quantityDiscountPercentForProduct(items[idx].quantity, p, discountTiers);
    setLine(idx, patch);
  };

  const matchesFor = (idx) => {
    const q = (query[idx] || "").trim().toLowerCase();
    const pool = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q) || (p.barcode || "").includes(q))
      : products;
    return pool.slice(0, 8);
  };

  const selectProduct = (idx, p) => {
    pickProduct(idx, p.id);
    setOpenIdx(null);
    setQuery((prev) => ({ ...prev, [idx]: "" }));
  };

  const clearProduct = (idx) => {
    pickProduct(idx, "");
    setOpenIdx(null);
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="table-th w-[26%]">{t("lineItems.colItem")}</th>
              <th className="table-th">{t("lineItems.colQty")}</th>
              <th className="table-th">{t("lineItems.colUnit")}</th>
              <th className="table-th text-right">{t("lineItems.colPrice", { currency })}</th>
              <th className="table-th text-right" title={t("lineItems.discountTiersHint")}>{t("lineItems.colDiscount")}</th>
              <th className="table-th text-right">{t("lineItems.colVat")}</th>
              <th className="table-th text-right">{t("lineItems.colTotal")}</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => {
              const lt = computeTotals([it]).total;
              return (
                <tr key={idx}>
                  <td className="table-td">
                    <div className="flex gap-2">
                      {(() => {
                        const p = products.find((x) => x.id === it.productId);
                        return p?.image
                          ? <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 mt-0.5"><img src={p.image} alt="" className="w-full h-full object-contain" /></div>
                          : <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-300 shrink-0 mt-0.5"><Icon name="image" size={13} /></div>;
                      })()}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="relative">
                          <input
                            className="input !py-1 text-xs"
                            placeholder={t("lineItems.searchProductPlaceholder")}
                            value={openIdx === idx ? (query[idx] || "") : (products.find((x) => x.id === it.productId)?.name || "")}
                            onFocus={() => { setOpenIdx(idx); setQuery((prev) => ({ ...prev, [idx]: "" })); }}
                            onChange={(e) => setQuery((prev) => ({ ...prev, [idx]: e.target.value }))}
                            onBlur={() => setTimeout(() => setOpenIdx((cur) => (cur === idx ? null : cur)), 150)}
                          />
                          {openIdx === idx && (
                            <div className="absolute z-20 left-0 right-0 top-full mt-1 card p-1 max-h-56 overflow-y-auto">
                              <button type="button" onMouseDown={() => clearProduct(idx)} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs text-slate-500">
                                {t("lineItems.freeText")}
                              </button>
                              {matchesFor(idx).length === 0 ? (
                                <div className="text-xs text-slate-400 p-2">{t("lineItems.noProductMatches")}</div>
                              ) : matchesFor(idx).map((p) => (
                                <button key={p.id} type="button" onMouseDown={() => selectProduct(idx, p)} className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs flex items-center justify-between gap-2">
                                  <span className="truncate">{p.name}</span>
                                  {p.trackStock !== false && <span className="text-slate-400 shrink-0 whitespace-nowrap">{t("lineItems.stockSuffix", { stock: p.stock })}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input className="input !py-1" placeholder={t("lineItems.descriptionPlaceholder")} value={it.description} onChange={(e) => setLine(idx, { description: e.target.value })} />
                      </div>
                    </div>
                  </td>
                  <td className="table-td">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input !py-1 w-24"
                      value={it.quantity}
                      onChange={(e) => {
                        const quantity = e.target.value;
                        const p = products.find((x) => x.id === it.productId);
                        const patch = { quantity };
                        const hasDiscount = p && (["cosmetic", "consumable"].includes(p.productType) || (p.customDiscountTiers || []).length > 0);
                        if (hasDiscount) patch.discount = quantityDiscountPercentForProduct(quantity, p, discountTiers);
                        setLine(idx, patch);
                      }}
                    />
                  </td>
                  <td className="table-td"><input className="input !py-1 w-16" value={it.unit} onChange={(e) => setLine(idx, { unit: e.target.value })} /></td>
                  <td className="table-td"><input type="number" step="any" min="0" className="input !py-1 w-24 text-right" value={it.unitPrice} onChange={(e) => setLine(idx, { unitPrice: e.target.value })} /></td>
                  <td className="table-td"><input type="number" step="any" min="0" max="100" className="input !py-1 w-20 text-right" value={it.discount} onChange={(e) => setLine(idx, { discount: e.target.value })} /></td>
                  <td className="table-td"><input type="number" step="any" min="0" className="input !py-1 w-20 text-right" value={it.vatRate} onChange={(e) => setLine(idx, { vatRate: e.target.value })} /></td>
                  <td className="table-td text-right font-semibold whitespace-nowrap">{money(lt, currency)}</td>
                  <td className="table-td"><button onClick={() => removeLine(idx)} disabled={items.length === 1} className="btn-ghost !px-2 !py-1 text-red-500 disabled:opacity-30"><Icon name="x" size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-100">
        <button onClick={addLine} className="btn-secondary"><Icon name="plus" size={15} /> {t("lineItems.addLine")}</button>
      </div>
    </div>
  );
}
