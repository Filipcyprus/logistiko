"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Αυτόματη δημιουργία σύμβασης παρακαταθήκης: διαλέγεις κατάστημα από τη λίστα (καταχωρισμένη στο
// tab "Καταστήματα") και τα στοιχεία του συμπληρώνονται αυτόματα δίπλα στα στοιχεία της επιχείρησης.
// Το χαρτί ξανατυπώνεται σε κάθε επίσκεψη με το τρέχον απόθεμα — η εκτύπωση με γραμμές αποθέματος
// στέλνει ταυτόχρονα το απόθεμα στο κατάστημα (ίδιο αποτέλεσμα με το tab "Απόθεμα").
// Το έγγραφο είναι έτοιμο πρότυπο — καλό είναι να ελεγχθεί από δικηγόρο πριν την πρώτη υπογραφή του.
export default function ConsignmentAgreementPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeId, setStoreId] = useState(searchParams.get("storeId") || "");
  const [startDate, setStartDate] = useState(todayISO());
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
    if (validLines.length === 0) { window.print(); return; }
    setSending(true);
    const res = await fetch("/api/consignment-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, date: startDate, items: validLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })) }),
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
  const supplierAfm = settings.afm || "";
  const supplierAddress = [settings.address, settings.city].filter(Boolean).join(", ");
  const supplierPhone = settings.phone || "";
  const supplierEmail = settings.email || "";
  const signingCity = settings.city || "";

  const storeLegal = store ? (store.legalName || store.name) : "";
  const storeAfm = store?.afm || "";
  const storeAddress = store ? [store.address, store.city].filter(Boolean).join(", ") : "";
  const storePhone = store?.phone || "";
  const storeEmail = store?.email || "";
  const storeContact = store?.contact || "";

  const dash = "—";
  const productName = (id) => products.find((p) => p.id === id)?.name || "";
  const productUnit = (id) => products.find((p) => p.id === id)?.unit || "τεμ.";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("consignment.generateAgreement")}</h1>
          <p className="text-sm text-slate-500">{t("consignment.agreementHint")}</p>
        </div>
        <button onClick={sendAndPrint} disabled={!store || sending} className="btn-primary">
          <Icon name="printer" size={15} /> {sending ? t("common.loading") : validLines.length > 0 ? t("consignment.sendAndPrint") : t("common.print")}
        </button>
      </div>

      {error && <div className="card p-3 bg-red-50 border-red-200 text-red-700 text-sm no-print">{error}</div>}

      <div className="card p-5 space-y-3 no-print">
        <div>
          <label className="label">{t("consignment.pickStore")}</label>
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">{t("consignment.pickStorePlaceholder")}</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {store && !(store.legalName || store.afm) && (
          <p className="text-xs text-amber-600">{t("consignment.storeMissingDetails")}</p>
        )}
        <div>
          <label className="label">{t("consignment.agreementStartDate")}</label>
          <input type="date" className="input max-w-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
              <select className="input flex-1" value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })}>
                <option value="">—</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
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
            <h2 className="text-lg font-bold tracking-wide">ΣΥΜΦΩΝΙΑ ΠΑΡΑΚΑΤΑΘΗΚΗΣ</h2>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Consignment Agreement</p>
          </div>

          <p>
            Η παρούσα συμφωνία καταρτίζεται και υπογράφεται στην πόλη «{signingCity || "Κύπρος"}» σήμερα,{" "}
            <strong>{formatDate(startDate)}</strong>, μεταξύ:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">(Α) Ο Προμηθευτής</div>
              <div className="font-semibold">{supplierName || dash}</div>
              {supplierAfm && <div>Α.Φ.Μ.: {supplierAfm}</div>}
              <div>{supplierAddress || dash}</div>
              {supplierPhone && <div>Τηλ.: {supplierPhone}</div>}
              {supplierEmail && <div>Email: {supplierEmail}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">(Β) Ο Παραλήπτης</div>
              <div className="font-semibold">{storeLegal || dash}</div>
              {store.name && store.name !== storeLegal && <div className="text-slate-500">({store.name})</div>}
              {storeAfm && <div>Α.Φ.Μ.: {storeAfm}</div>}
              <div>{storeAddress || dash}</div>
              {storePhone && <div>Τηλ.: {storePhone}</div>}
              {storeEmail && <div>Email: {storeEmail}</div>}
              {storeContact && <div>Εκπρόσωπος: {storeContact}</div>}
            </div>
          </div>

          <p>
            (εφεξής ο μεν πρώτος «ο Προμηθευτής», ο δε δεύτερος «ο Παραλήπτης»), και συμφωνούνται αμοιβαία τα ακόλουθα:
          </p>

          <ol className="space-y-3 list-decimal pl-5">
            <li>
              <strong>Αντικείμενο.</strong> Ο Προμηθευτής θα παραδίδει κατά καιρούς στον Παραλήπτη προϊόντα (αρώματα και
              συναφή είδη) προς έκθεση και πώληση στο κατάστημα του Παραλήπτη, επί τη βάσει παρακαταθήκης (consignment).
              Το απόθεμα που παραδίδεται σε κάθε επίσκεψη αναγράφεται στον πίνακα του παρόντος εγγράφου.
            </li>
            <li>
              <strong>Κυριότητα.</strong> Η κυριότητα των προϊόντων παραμένει στον Προμηθευτή μέχρι την πώλησή τους σε
              τελικό πελάτη. Ο Παραλήπτης δεν αποκτά κυριότητα επί των προϊόντων και δεν δικαιούται να τα ενεχυριάσει,
              να τα μεταβιβάσει ή να τα χρησιμοποιήσει καθ&#39; οιονδήποτε άλλο τρόπο πέραν της πώλησής τους στο πλαίσιο
              της συνήθους εμπορικής δραστηριότητας του καταστήματος.
            </li>
            <li>
              <strong>Τιμές &amp; Απόδοση Εσόδων.</strong> Οι τιμές πώλησης στο κοινό συμφωνούνται μεταξύ των μερών ανά
              προϊόν. Ο Παραλήπτης αποδίδει στον Προμηθευτή το συμφωνηθέν τίμημα για τα πωληθέντα προϊόντα κατά την
              εκάστοτε επίσκεψη του Προμηθευτή στο κατάστημα, οπότε και ανανεώνεται το απόθεμα με νέο έγγραφο
              παρακαταθήκης.
            </li>
            <li>
              <strong>Καταγραφή Αποθέματος.</strong> Ο Παραλήπτης υποχρεούται να τηρεί ακριβή καταγραφή του αποθέματος
              που του παραδίδεται και των πωλήσεων που πραγματοποιεί, και να ενημερώνει τον Προμηθευτή σχετικά όποτε
              ζητηθεί.
            </li>
            <li>
              <strong>Φύλαξη &amp; Ευθύνη.</strong> Ο Παραλήπτης οφείλει να φυλάσσει τα προϊόντα με επιμέλεια, σε
              κατάλληλες συνθήκες, και ευθύνεται για τυχόν απώλεια, ζημιά ή κλοπή τους πέραν της συνήθους φθοράς από
              την έκθεσή τους προς πώληση.
            </li>
            <li>
              <strong>Επιστροφές.</strong> Μη πωληθέντα προϊόντα δύνανται να επιστραφούν στον Προμηθευτή οποτεδήποτε,
              κατόπιν συνεννόησης, χωρίς καμία χρέωση για τον Παραλήπτη.
            </li>
            <li>
              <strong>Διάρκεια.</strong> Το παρόν έγγραφο, μαζί με το απόθεμα που αναγράφεται σε αυτό, ισχύει μέχρι την
              επόμενη επίσκεψη του Προμηθευτή στο κατάστημα, οπότε υπογράφεται νέο έγγραφο που το αντικαθιστά πλήρως,
              με το επικαιροποιημένο απόθεμα και τους διακανονισμούς πληρωμής.
            </li>
            <li>
              <strong>Λοιποί Όροι.</strong> Οποιαδήποτε τροποποίηση της παρούσας συμφωνίας ισχύει μόνο εφόσον γίνει
              εγγράφως και υπογραφεί και από τα δύο μέρη.
            </li>
          </ol>

          {validLines.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Απόθεμα παράδοσης — {formatDate(startDate)}</div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left font-semibold py-1">Προϊόν</th>
                    <th className="text-right font-semibold py-1">Ποσότητα</th>
                  </tr>
                </thead>
                <tbody>
                  {validLines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1">{productName(l.productId)}</td>
                      <td className="text-right py-1">{l.quantity} {productUnit(l.productId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">Συντάχθηκε σε δύο (2) πρωτότυπα, από ένα για κάθε μέρος.</p>

          <div className="grid grid-cols-2 gap-6 pt-10 text-center">
            <div>
              <div className="border-t border-slate-400 pt-2">
                <div className="font-semibold">Ο ΠΡΟΜΗΘΕΥΤΗΣ</div>
                <div className="text-xs text-slate-500 mt-1">(υπογραφή &amp; σφραγίδα)</div>
                <div className="mt-8 text-xs text-slate-500">{supplierName}</div>
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2">
                <div className="font-semibold">Ο ΠΑΡΑΛΗΠΤΗΣ</div>
                <div className="text-xs text-slate-500 mt-1">(υπογραφή &amp; σφραγίδα)</div>
                <div className="mt-8 text-xs text-slate-500">{storeLegal}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!store && <p className="text-slate-400 text-sm no-print">{t("consignment.pickStoreToPreview")}</p>}
    </div>
  );
}
