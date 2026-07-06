"use client";

import { money, computeTotals } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function emptyLine(vatRate = 24, unit = "pcs") {
  return { productId: null, description: "", quantity: 1, unit, unitPrice: 0, vatRate, discount: 0 };
}

export default function LineItems({ items, onChange, products = [], currency = "€", defaultVat = 24 }) {
  const { t } = useLanguage();
  const setLine = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addLine = () => onChange([...items, emptyLine(defaultVat, t("common.unit"))]);
  const removeLine = (idx) => onChange(items.filter((_, i) => i !== idx));

  const pickProduct = (idx, productId) => {
    if (!productId) return setLine(idx, { productId: null });
    const p = products.find((x) => x.id === productId);
    if (p) setLine(idx, { productId: p.id, description: p.name, unit: p.unit, unitPrice: p.price, vatRate: p.vatRate });
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
              <th className="table-th text-right">{t("lineItems.colDiscount")}</th>
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
                          ? <img src={p.image} alt="" className="w-8 h-8 rounded object-cover shrink-0 mt-0.5" />
                          : <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-300 shrink-0 mt-0.5"><Icon name="image" size={13} /></div>;
                      })()}
                      <div className="space-y-1 flex-1 min-w-0">
                        <select className="input !py-1 text-xs" value={it.productId || ""} onChange={(e) => pickProduct(idx, e.target.value)}>
                          <option value="">{t("lineItems.freeText")}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}{p.trackStock !== false ? t("lineItems.stockSuffix", { stock: p.stock }) : ""}</option>
                          ))}
                        </select>
                        <input className="input !py-1" placeholder={t("lineItems.descriptionPlaceholder")} value={it.description} onChange={(e) => setLine(idx, { description: e.target.value })} />
                      </div>
                    </div>
                  </td>
                  <td className="table-td"><input type="number" step="any" min="0" className="input !py-1 w-24" value={it.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} /></td>
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
