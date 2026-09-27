"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import ProductPicker from "@/components/ProductPicker";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Δελτίο Αποστολής Παρακαταθήκης: το χαρτί που δίνεις σε ΚΑΘΕ επίσκεψη σε ήδη συμβεβλημένο
// κατάστημα (η Σύμβαση Παρακαταθήκης — δική της σελίδα — υπογράφεται μία φορά, όχι σε κάθε
// επίσκεψη). Διαλέγεις κατάστημα, επιλέγεις τι φέρνεις σήμερα, και η εκτύπωση ταυτόχρονα στέλνει
// το απόθεμα στο κατάστημα (ίδιο αποτέλεσμα με το tab "Απόθεμα").
export default function ConsignmentDeliveryNotePage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeId, setStoreId] = useState(searchParams.get("storeId") || "");
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState([{ productId: "", quantity: 1 }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/products").then((r) => (r.ok ? r.json() : [])).then((list) => setProducts(list.filter((p) => p.department === "perfumes")));
    fetch("/api/consignment-stores").then((r) => (r.ok ? r.json() : [])).then((list) => {
      setStores(list);
      if (!storeId && list.length === 1) setStoreId(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const store = useMemo(() => stores.find((s) => s.id === storeId) || null, [stores, storeId]);
  const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);

  const setLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { productId: "", quantity: 1 }]);
  const removeLine = (i) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const sendAndPrint = async () => {
    setError("");
    if (validLines.length === 0) return;
    setSending(true);
    const res = await fetch("/api/consignment-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, date, items: validLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })) }),
    });
    setSending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ? t(err.error) : t("common.error"));
      return;
    }
    window.print();
  };

  if (!settings) return <div className="text-slate-400 text-sm">{t("common.loading")}</div>;

  const supplierName = settings.companyName || "";
  const supplierAddress = [settings.address, settings.city].filter(Boolean).join(", ");
  const supplierPhone = settings.phone || "";

  const storeLegal = store ? (store.legalName || store.name) : "";
  const storeAddress = store ? [store.address, store.city].filter(Boolean).join(", ") : "";
  const storeContact = store?.contact || "";

  const dash = "—";
  const productName = (id) => products.find((p) => p.id === id)?.name || "";
  const productUnit = (id) => products.find((p) => p.id === id)?.unit || "τεμ.";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("consignment.generateDeliveryNote")}</h1>
          <p className="text-sm text-slate-500">{t("consignment.deliveryNoteHint")}</p>
        </div>
        <button onClick={sendAndPrint} disabled={!store || sending || validLines.length === 0} className="btn-primary">
          <Icon name="printer" size={15} /> {sending ? t("common.loading") : t("consignment.sendAndPrint")}
        </button>
      </div>

      {error && <div className="card p-3 bg-red-50 border-red-200 text-red-700 text-sm no-print">{error}</div>}

      <div className="card p-5 space-y-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("consignment.pickStore")}</label>
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">{t("consignment.pickStorePlaceholder")}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("consignment.fieldSendDate")}</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3 no-print">
        <div>
          <h2 className="font-semibold text-slate-700">{t("consignment.agreementStockTitle")}</h2>
          <p className="text-xs text-slate-500">{t("consignment.agreementStockHint")}</p>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <ProductPicker className="flex-1" products={products} value={l.productId} onChange={(id) => setLine(i, { productId: id })} />
              <input type="number" min="1" step="any" className="input w-24" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              {lines.length > 1 && <button onClick={() => removeLine(i)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button>}
            </div>
          ))}
        </div>
        <button onClick={addLine} className="btn-secondary text-sm"><Icon name="plus" size={14} /> {t("consignment.addProductLine")}</button>
      </div>

      {store && (
        <div className="card p-8 sm:p-12 print-area space-y-6 text-sm leading-relaxed text-slate-800">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold tracking-wide">ΔΕΛΤΙΟ ΑΠΟΣΤΟΛΗΣ ΠΑΡΑΚΑΤΑΘΗΚΗΣ</h2>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Consignment Delivery Note</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Αποστολέας</div>
              <div className="font-semibold">{supplierName || dash}</div>
              <div>{supplierAddress || dash}</div>
              {supplierPhone && <div>Τηλ.: {supplierPhone}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Παραλήπτης</div>
              <div className="font-semibold">{storeLegal || dash}</div>
              {store.name && store.name !== storeLegal && <div className="text-slate-500">({store.name})</div>}
              <div>{storeAddress || dash}</div>
              {storeContact && <div>Εκπρόσωπος: {storeContact}</div>}
            </div>
          </div>

          <div className="flex justify-between text-slate-500">
            <span>Ημερομηνία: <strong className="text-slate-800">{formatDate(date)}</strong></span>
          </div>

          <p className="text-xs text-slate-500">
            Η παρούσα παράδοση γίνεται επί τη βάσει παρακαταθήκης (consignment), σύμφωνα με τη Σύμβαση
            Παρακαταθήκης που έχει υπογραφεί μεταξύ των δύο μερών.
          </p>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-left font-semibold py-1">Προϊόν</th>
                <th className="text-right font-semibold py-1">Ποσότητα</th>
              </tr>
            </thead>
            <tbody>
              {validLines.length === 0 ? (
                <tr><td className="py-2 text-slate-400" colSpan={2}>—</td></tr>
              ) : validLines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1">{productName(l.productId)}</td>
                  <td className="text-right py-1">{l.quantity} {productUnit(l.productId)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-6 pt-10 text-center">
            <div>
              <div className="border-t border-slate-400 pt-2">
                <div className="font-semibold">Ο ΑΠΟΣΤΟΛΕΑΣ</div>
                <div className="text-xs text-slate-500 mt-1">(υπογραφή)</div>
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2">
                <div className="font-semibold">Ο ΠΑΡΑΛΗΠΤΗΣ</div>
                <div className="text-xs text-slate-500 mt-1">(υπογραφή)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!store && <p className="text-slate-400 text-sm no-print">{t("consignment.pickStoreToPreview")}</p>}
    </div>
  );
}
