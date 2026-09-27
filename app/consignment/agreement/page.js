"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Σύμβαση παρακαταθήκης: υπογράφεται ΜΙΑ φορά με το κατάστημα, ορίζει τους γενικούς όρους
// συνεργασίας. Διαλέγεις κατάστημα από τη λίστα (καταχωρισμένη στο tab "Καταστήματα") και τα
// στοιχεία του συμπληρώνονται αυτόματα δίπλα στα στοιχεία της επιχείρησης.
// Η παράδοση αποθέματος σε κάθε επόμενη επίσκεψη γίνεται με το Δελτίο Αποστολής (ξεχωριστή σελίδα),
// όχι με επανυπογραφή αυτής της σύμβασης.
// Το έγγραφο είναι έτοιμο πρότυπο — καλό είναι να ελεγχθεί από δικηγόρο πριν την πρώτη υπογραφή του.
export default function ConsignmentAgreementPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState(searchParams.get("storeId") || "");
  const [startDate, setStartDate] = useState(todayISO());

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/consignment-stores").then((r) => (r.ok ? r.json() : [])).then((list) => {
      setStores(list);
      if (!storeId && list.length === 1) setStoreId(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const store = useMemo(() => stores.find((s) => s.id === storeId) || null, [stores, storeId]);

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

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("consignment.generateAgreement")}</h1>
          <p className="text-sm text-slate-500">{t("consignment.agreementHint")}</p>
        </div>
        <button onClick={() => window.print()} disabled={!store} className="btn-primary"><Icon name="printer" size={15} /> {t("common.print")}</button>
      </div>

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
              Κάθε παράδοση καταγράφεται σε ξεχωριστό Δελτίο Αποστολής, το οποίο αποτελεί αναπόσπαστο μέρος της
              παρούσας συμφωνίας.
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
              εκάστοτε επίσκεψη του Προμηθευτή στο κατάστημα, οπότε παραδίδεται και τυχόν νέο απόθεμα με το αντίστοιχο
              Δελτίο Αποστολής.
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
              <strong>Διάρκεια &amp; Καταγγελία.</strong> Η παρούσα συμφωνία ισχύει από την ημερομηνία υπογραφής της
              και εφεξής, για αόριστο χρονικό διάστημα. Οποιοδήποτε από τα δύο μέρη δύναται να την καταγγείλει
              οποτεδήποτε, με γραπτή ειδοποίηση προς το άλλο μέρος, οπότε τα μη πωληθέντα προϊόντα θα επιστρέφονται
              άμεσα στον Προμηθευτή.
            </li>
            <li>
              <strong>Λοιποί Όροι.</strong> Οποιαδήποτε τροποποίηση της παρούσας συμφωνίας ισχύει μόνο εφόσον γίνει
              εγγράφως και υπογραφεί και από τα δύο μέρη.
            </li>
          </ol>

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
