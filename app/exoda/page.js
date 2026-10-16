"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { money, formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import ReviewDialog from "@/components/ReviewDialog";
import { purchaseTotal } from "@/lib/purchaseMath";
import { downloadHref } from "@/lib/attachments";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const CATEGORY_KEYS = ["rawMaterials", "ink", "rent", "utilities", "payroll", "equipment", "vehicle", "phoneInternet", "repairs", "office", "cleaning", "shipping", "marketing", "general", "purchaseOrder"];
const empty = { date: todayISO(), category: "general", description: "", supplier: "", net: 0, vat: 0, vatRate: 19, amount: "", paymentMethod: "cash", accountId: "", _basis: "total" };
const newForm = (keep = {}) => ({ ...empty, date: todayISO(), ...keep });

// Οι συνηθισμένοι συντελεστές ΦΠΑ — 21% (Ρουμανία, για αγορές από εκεί), 19% κανονικός Κύπρου,
// 9% (ξενοδοχεία/εστίαση), 5% (βιβλία, τρόφιμα, φάρμακα κ.λπ.), 0% (απαλλαγές/εξαγωγές). "custom" = ό,τι ποσό γράψει ο χρήστης, χωρίς
// να ξαναϋπολογιστεί όταν αλλάζει το καθαρό ποσό.
const VAT_RATES = [21, 19, 9, 5, 0];

// Ανοίγοντας παλιό έξοδο για επεξεργασία, μάντεψε ποιον συντελεστή είχε (δεν αποθηκευόταν πριν) —
// αλλιώς κάθε παλιά εγγραφή θα άνοιγε σαν "Custom" χωρίς λόγο.
function inferVatRate(e) {
  if (e.vatLines?.length > 1) return "mixed";
  const net = Number(e.net || 0);
  const vat = Number(e.vat || 0);
  if (!net) return e.vatRate ?? 19;
  const pct = Math.round((vat / net) * 10000) / 100;
  const match = VAT_RATES.find((r) => Math.abs(r - pct) < 0.05);
  return e.vatRate ?? match ?? "custom";
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const PO_STATUS = {
  draft: { key: "purchases.statusDraft", color: "bg-slate-100 text-slate-600" },
  sent: { key: "purchases.statusSent", color: "bg-sky-100 text-sky-700" },
  received: { key: "purchases.statusReceived", color: "bg-emerald-100 text-emerald-700" },
};

function ExpensesInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "purchases" ? "purchases" : "expenses");

  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  // Προεπιλογή: όλα τα έξοδα — με φίλτρο τρέχοντος μήνα, παραστατικά προηγούμενων μηνών που
  // καταχωρούνται τώρα φαίνονταν "χαμένα". Το φίλτρο μήνα παραμένει διαθέσιμο.
  const [month, setMonth] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [checks, setChecks] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [paying, setPaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const fileRef = useRef();

  const load = () => {
    fetch("/api/expenses").then((r) => r.json()).then(setExpenses);
    fetch("/api/purchases").then((r) => r.json()).then(setPurchases);
  };
  useEffect(() => {
    load();
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/accounts").then((r) => (r.ok ? r.json() : [])).then(setAccounts);
  }, []);

  const accName = (a) => (a?.name ? a.name : a?.nameKey ? t(a.nameKey) : "");
  // Ποιον λογαριασμό θα χρεώσει το έξοδο αν δεν επιλεγεί ρητά — ίδια αντιστοίχιση με το
  // lib/accounts.js, ώστε η φόρμα να δείχνει από πριν πού θα καταλήξει.
  const CATEGORY_ACCOUNT = {
    rawMaterials: "expMaterials", ink: "expMaterials", rent: "expRent",
    utilities: "expUtilities", payroll: "expPayroll", equipment: "expEquipment",
    shipping: "expShipping", marketing: "expMarketing", vehicle: "expVehicle",
    phoneInternet: "expPhone", repairs: "expRepairs", office: "expOffice", cleaning: "expCleaning", purchaseOrder: "inventory",
  };
  const autoAccountFor = (category) => {
    const key = CATEGORY_ACCOUNT[category];
    return accounts.find((a) => a.systemKey === (key || "expensesNet"));
  };

  const switchTab = (tb) => { setTab(tb); router.replace(tb === "purchases" ? "/exoda?tab=purchases" : "/exoda"); };

  // Πληρώθηκε ή όχι μια παραλαβή: παρακαταθήκη = δεν οφείλεται τίποτα ακόμα, επί πιστώσει =
  // χρωστάμε (με το υπόλοιπο), οτιδήποτε άλλο = πληρώθηκε επιτόπου.
  const poPaidBadge = (po, total) => {
    if (!po.received) return <span className="text-slate-400">—</span>;
    if (po.consignment) return <span className="badge bg-violet-100 text-violet-700">{t("purchases.consignment")}</span>;
    if (po.paymentMethod === "credit") {
      const paidAmount = Number(po.paidAmount || 0);
      return po.paid ? <span className="badge bg-emerald-100 text-emerald-700">{t("expenses.paid")}</span> : (
        <>
          <span className="badge bg-amber-100 text-amber-700">{t("expenses.unpaid")}</span>
          <div className="text-xs text-slate-400 mt-0.5">{money(paidAmount)} / {money(total)}</div>
        </>
      );
    }
    return (
      <>
        <span className="badge bg-emerald-100 text-emerald-700">{t("expenses.paid")}</span>
        <div className="text-xs text-slate-400 mt-0.5">{t(po.paymentMethod === "bank" ? "common.paymentMethods.bank" : "common.paymentMethods.cash")}</div>
      </>
    );
  };

  // Ταξινόμηση κατά ημερομηνία παραστατικού (πιο πρόσφατα πρώτα), όχι με σειρά καταχώρισης —
  // αλλιώς παραστατικά που καταχωρούνται μαζί αργότερα εμφανίζονται ανακατεμένα.
  const filtered = expenses
    .filter((e) => !month || (e.date || "").startsWith(month))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.number || "").localeCompare(String(a.number || "")));
  const total = filtered.reduce((a, x) => a + Number(x.amount || 0), 0);
  const categoryLabel = (key) => t(`expenses.categories.${key}`) || key;
  // Χρεώνει το ΦΠΑ με βάση τον επιλεγμένο συντελεστή — εκτός αν είναι "custom", οπότε ο χρήστης
  // το γράφει ο ίδιος και δεν ξαναϋπολογίζεται όσο αλλάζει το καθαρό ποσό.
  // Οι αποδείξεις γράφουν το ΣΥΝΟΛΟ — οπότε το συνηθισμένο είναι να γράφεις το σύνολο και να
  // βγαίνουν καθαρό + ΦΠΑ μόνα τους. Αν γράψεις καθαρό (τιμολόγιο), υπολογίζεται το σύνολο.
  const recalc = (f) => {
    if (f.vatRate === "custom") {
      return f._basis === "net" ? { ...f, amount: round2(Number(f.net) + Number(f.vat)) } : f;
    }
    const rate = Number(f.vatRate) / 100;
    if (f._basis === "net") {
      const vat = round2(Number(f.net) * rate);
      return { ...f, vat, amount: round2(Number(f.net) + vat) };
    }
    const net = round2(Number(f.amount) / (1 + rate));
    return { ...f, net, vat: round2(Number(f.amount) - net) };
  };
  const updTotal = (v) => setForm(recalc({ ...form, amount: v, _basis: "total" }));
  const updNet = (v) => setForm(recalc({ ...form, net: v, _basis: "net" }));
  const updVatRate = (rate) => setForm(recalc({ ...form, vatRate: rate }));

  // Ένα τιμολόγιο με δύο συντελεστές ΦΠΑ (π.χ. βιβλία 5% + μεταφορικά 19%) μπαίνει ως ΕΝΑ έξοδο
  // με γραμμές ΦΠΑ· καθαρό/ΦΠΑ/σύνολο του εξόδου είναι το άθροισμά τους.
  const isSplit = form?.vatLines?.length > 1;
  const withLines = (f, lines) => {
    const ls = lines.map((l) => ({ ...l, vat: round2(Number(l.net || 0) * (Number(l.rate) / 100)) }));
    const net = round2(ls.reduce((a, l) => a + Number(l.net || 0), 0));
    const vat = round2(ls.reduce((a, l) => a + l.vat, 0));
    return { ...f, vatLines: ls, net, vat, amount: round2(net + vat), vatRate: "mixed", _basis: "net" };
  };
  const splitVat = () => {
    const rate = form.vatRate !== "custom" && form.vatRate !== "mixed" ? Number(form.vatRate) : 19;
    setForm(withLines(form, [{ rate, net: form.net || "" }, { rate: rate === 5 ? 19 : 5, net: "" }]));
  };
  const updLine = (i, patch) => setForm(withLines(form, form.vatLines.map((l, j) => (j === i ? { ...l, ...patch } : l))));
  const removeLine = (i) => {
    const rest = form.vatLines.filter((_, j) => j !== i);
    if (rest.length > 1) { setForm(withLines(form, rest)); return; }
    setForm(recalc({ ...form, vatLines: null, vatRate: rest[0].rate, net: rest[0].net, _basis: "net" }));
  };

  // Το κατάστημα γράφεται ελεύθερα — δεν χρειάζεται να καταχωριστεί πρώτα ως προμηθευτής.
  // Προτείνονται όσα έχεις ήδη χρησιμοποιήσει, και ξαναδιαλέγοντας ένα γεμίζουν κατηγορία/ΦΠΑ/πληρωμή
  // όπως την τελευταία φορά.
  const lastByShop = useMemo(() => {
    const map = new Map();
    [...expenses].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).forEach((e) => {
      const k = (e.supplier || "").trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, e);
    });
    return map;
  }, [expenses]);
  const shopNames = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const n of [...[...lastByShop.values()].map((e) => e.supplier.trim()), ...suppliers.map((s) => s.name.trim())]) {
      const k = n.toLowerCase();
      if (n && !seen.has(k)) { seen.add(k); out.push(n); }
    }
    return out;
  }, [lastByShop, suppliers]);
  const updShop = (value) => {
    let next = { ...form, supplier: value };
    const last = !form.id && lastByShop.get(value.trim().toLowerCase());
    if (last) {
      if (form.category === "general" && last.category) next.category = last.category;
      if (form.paymentMethod === "cash" && last.paymentMethod && last.paymentMethod !== "credit") next.paymentMethod = last.paymentMethod;
      if (!form.accountId && last.accountId) next.accountId = last.accountId;
      if (!form.description.trim() && last.description && last.description.trim().toLowerCase() !== last.supplier.trim().toLowerCase()) next.description = last.description;
      if (Number(form.vatRate) === 19 && !last.vatLines?.length) next.vatRate = inferVatRate(last);
      next = recalc(next);
    }
    setForm(next);
  };

  // Έλεγχος πριν μπει το έξοδο στα βιβλία. Πιάνει τα λάθη που δεν φαίνονται μετά: ποσό χωρίς ΦΠΑ
  // που δεν θα συμψηφιστεί ποτέ, καθαρό+ΦΠΑ που δεν βγάζει το σύνολο, διπλοκαταχώριση του ίδιου
  // τιμολογίου, ημερομηνία στο μέλλον.
  const expenseChecks = () => {
    const out = [];
    const net = Number(form.net || 0);
    const vat = Number(form.vat || 0);
    const amount = Number(form.amount || 0);

    if (amount <= 0) out.push({ level: "error", text: t("review.expNeedAmount") });
    if (form.date > todayISO()) out.push({ level: "error", text: t("review.dateInFuture") });

    if (round2(net + vat) !== round2(amount)) {
      out.push({ level: "warn", text: t("review.expTotalMismatch", { sum: money(round2(net + vat)), total: money(amount) }) });
    }
    // Μηδενικό ΦΠΑ δεν προειδοποιεί όταν επιλέχθηκε ρητά ο συντελεστής 0% — μόνο όταν φαίνεται
    // ξεχασμένο (π.χ. έμεινε στο "Custom" χωρίς να μπει ποτέ ποσό).
    if (amount > 0 && !vat && String(form.vatRate) !== "0") out.push({ level: "warn", text: t("review.expNoVat") });

    const dup = expenses.find((e) => e.id !== form.id && e.date === form.date && round2(e.amount) === round2(amount) && (e.supplier || "") === (form.supplier || ""));
    if (dup) out.push({ level: "warn", text: t("review.expDuplicate", { number: dup.number || "", description: dup.description }) });

    const acc = form.accountId ? accounts.find((a) => a.id === form.accountId) : autoAccountFor(form.category);
    if (acc) out.push({ level: "info", text: t("review.expAccount", { account: `${acc.number} ${accName(acc)}` }) });
    if (form.paymentMethod === "credit") out.push({ level: "info", text: t("review.expUnpaid") });

    return out;
  };

  const save = (another = false) => {
    setAddAnother(another);
    const found = expenseChecks();
    if (found.some((c) => c.level !== "info")) { setChecks(found); return; }
    commitSave(another);
  };

  const commitSave = async (another = addAnother) => {
    setSaving(true);
    // Σύνδεσε το ελεύθερο όνομα προμηθευτή με την καρτέλα του, όταν ταιριάζει — έτσι ένα απλήρωτο
    // τιμολόγιο μπορεί να εξοφληθεί αργότερα και να μπει στην ενηλικίωση υπολοίπων.
    const matched = suppliers.find((s) => s.name.trim().toLowerCase() === (form.supplier || "").trim().toLowerCase());
    const { _basis, ...rest } = form;
    const description = form.description.trim() || form.supplier.trim() || categoryLabel(form.category);
    const vatLines = form.vatLines?.length > 1 ? form.vatLines.map((l) => ({ rate: Number(l.rate), net: round2(Number(l.net || 0)), vat: l.vat })) : null;
    const payload = { ...rest, description, vatLines, supplierId: matched?.id || null };
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/expenses/${form.id}` : "/api/expenses";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setChecks(null); setSaving(false); load();
    // "Αποθήκευση & νέο": μένει ανοιχτή φόρμα με ίδια ημερομηνία/πληρωμή για την επόμενη απόδειξη.
    setForm(another ? newForm({ date: form.date, paymentMethod: form.paymentMethod }) : null);
  };

  // Το παραστατικό φυλάσσεται ως αρχείο στον δίσκο (/api/uploads) και στο έξοδο μένει μόνο ο
  // σύνδεσμος. Αν έμπαινε base64 μέσα στο db.json, κάθε αίτημα του app (μέχρι και κάθε σκανάρισμα
  // στο Ταμείο) θα κουβαλούσε ολόκληρες τις φωτογραφίες των τιμολογίων.
  const onAttach = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) { alert(t("common.error")); return; }
    const uploaded = await res.json();
    setForm((f) => ({ ...f, attachment: { url: uploaded.url, name: uploaded.name, type: uploaded.type, size: uploaded.size } }));
  };

  const openPay = (e) => {
    const outstanding = round2(Number(e.amount || 0) - Number(e.paidAmount || 0));
    setPayForm({ expense: e, amount: String(Math.max(0, outstanding)), method: "cash", date: todayISO() });
  };
  const submitPay = async () => {
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) { alert(t("purchases.errInvalidAmount")); return; }
    setPaying(true);
    await fetch("/api/supplier-payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId: payForm.expense.id, supplierId: payForm.expense.supplierId || null, amount, method: payForm.method, date: payForm.date }),
    });
    setPaying(false); setPayForm(null); load();
  };
  const del = async (id) => {
    if (!confirm(t("expenses.confirmDelete"))) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    load();
  };
  const delPO = async (id) => {
    if (!confirm(t("purchases.confirmDelete"))) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{tab === "expenses" ? t("expenses.title") : t("purchases.title")}</h1>
          <p className="text-slate-500 text-sm">{tab === "expenses" ? t("expenses.periodTotal", { total: money(total) }) : t("purchases.countLabel", { count: purchases.length })}</p>
        </div>
        {tab === "expenses"
          ? <button onClick={() => setForm(newForm())} className="btn-primary"><Icon name="plus" size={16} /> {t("expenses.newExpense")}</button>
          : (
            <div className="flex items-center gap-2">
              <Link href="/agores/lista" className="btn-secondary"><Icon name="cart" size={16} /> {t("stock.reorderList")}</Link>
              <Link href="/agores/nea" className="btn-primary"><Icon name="plus" size={16} /> {t("purchases.newPO")}</Link>
            </div>
          )}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => switchTab("expenses")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "expenses" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("purchases.tabExpenses")}</button>
        <button onClick={() => switchTab("purchases")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "purchases" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("purchases.tabPurchases")}</button>
      </div>

      {tab === "expenses" ? (
        <>
          <div className="card p-4 flex items-center gap-3">
            <label className="text-sm text-slate-500">{t("expenses.month")}</label>
            <input type="month" className="input max-w-[200px]" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button onClick={() => setMonth("")} className="btn-ghost text-sm">{t("expenses.all")}</button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">{t("expenses.colDate")}</th>
                    <th className="table-th">{t("expenses.colCategory")}</th>
                    <th className="table-th">{t("expenses.colDescription")}</th>
                    <th className="table-th">{t("expenses.colSupplier")}</th>
                    <th className="table-th text-right">{t("expenses.colNet")}</th>
                    <th className="table-th text-right">{t("expenses.colVat")}</th>
                    <th className="table-th text-right">{t("expenses.colTotal")}</th>
                    <th className="table-th">{t("expenses.colPaid")}</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={9}>{t("expenses.noExpenses")}</td></tr>
                  ) : filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="table-td">{formatDate(e.date)}</td>
                      <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{categoryLabel(e.category)}</span></td>
                      <td className="table-td font-medium">{e.description}{e.number && <div className="text-xs text-slate-400 font-normal">{e.number}</div>}</td>
                      <td className="table-td">{e.supplier || "—"}</td>
                      <td className="table-td text-right">{money(e.net)}</td>
                      <td className="table-td text-right">{money(e.vat)}{e.vatLines?.length > 1 && <div className="text-xs text-slate-400">{e.vatLines.map((l) => `${l.rate}%`).join(" + ")}</div>}</td>
                      <td className="table-td text-right font-semibold">{money(e.amount)}</td>
                      <td className="table-td">
                        {e.paymentMethod !== "credit" ? (
                          <span className="badge bg-emerald-100 text-emerald-700">{t("expenses.paid")}</span>
                        ) : e.paid ? (
                          <span className="badge bg-emerald-100 text-emerald-700">{t("expenses.paid")}</span>
                        ) : (
                          <>
                            <span className="badge bg-amber-100 text-amber-700">{t("expenses.unpaid")}</span>
                            {Number(e.paidAmount) > 0 && <div className="text-xs text-slate-400 mt-0.5">{money(e.paidAmount)} / {money(e.amount)}</div>}
                          </>
                        )}
                      </td>
                      <td className="table-td text-right whitespace-nowrap">
                        {e.paymentMethod === "credit" && !e.paid && (
                          <button onClick={() => openPay(e)} title={t("purchases.recordPayment")} className="btn-ghost !px-2 !py-1 text-emerald-600"><Icon name="wallet" size={15} /></button>
                        )}
                        {e.attachment && (
                          <a href={downloadHref(e.attachment.url, e.attachment.name) || e.attachment.data} download={e.attachment.name} target="_blank" rel="noreferrer" title={t("expenses.viewInvoice")} className="btn-ghost !px-2 !py-1 inline-flex"><Icon name="download" size={15} /></a>
                        )}
                        {e.purchaseOrderId && (
                          <Link href={`/agores/${e.purchaseOrderId}`} title={t("expenses.viewPO")} className="btn-ghost !px-2 !py-1 inline-flex"><Icon name="external" size={15} /></Link>
                        )}
                        <button onClick={() => setForm({ ...empty, ...e, vatRate: inferVatRate(e), _basis: "net" })} className="btn-ghost !px-2 !py-1"><Icon name="edit" size={15} /></button>
                        <button onClick={() => del(e.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("purchases.colNumber")}</th>
                  <th className="table-th">{t("purchases.colDate")}</th>
                  <th className="table-th">{t("purchases.colSupplier")}</th>
                  <th className="table-th">{t("purchases.colStatus")}</th>
                  <th className="table-th text-right">{t("expenses.colTotal")}</th>
                  <th className="table-th">{t("expenses.colPaid")}</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={7}>{t("purchases.noEntries")}</td></tr>
                ) : purchases.map((po) => {
                  const st = PO_STATUS[po.status] || PO_STATUS.draft;
                  const total = purchaseTotal(po);
                  return (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="table-td font-semibold"><Link href={`/agores/${po.id}`} className="text-brand-700 hover:underline">{po.number}</Link></td>
                      <td className="table-td">{formatDate(po.date)}</td>
                      <td className="table-td">{po.supplier?.name || "—"}</td>
                      <td className="table-td"><span className={`badge ${st.color}`}>{t(st.key)}</span></td>
                      <td className="table-td text-right font-medium">{money(total)}</td>
                      <td className="table-td">{poPaidBadge(po, total)}</td>
                      <td className="table-td text-right whitespace-nowrap">
                        <Link href={`/agores/${po.id}`} className="btn-ghost !px-2 !py-1"><Icon name="eye" size={15} /></Link>
                        <button onClick={() => delPO(po.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{form.id ? t("expenses.modalEdit") : t("expenses.modalNew")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t("expenses.fieldTotal")}</label>
                <input type="number" step="any" inputMode="decimal" autoFocus={!form.id} className="input text-lg font-semibold" value={form.amount} readOnly={isSplit} onChange={(e) => !isSplit && updTotal(e.target.value)} placeholder="0.00" />
              </div>
              <div><label className="label">{t("expenses.fieldDate")}</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div>
                <label className="label">{t("expenses.fieldShop")}</label>
                <input className="input" list="shop-list" value={form.supplier} onChange={(e) => updShop(e.target.value)} placeholder={t("expenses.shopPlaceholder")} />
                <datalist id="shop-list">{shopNames.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
              <div><label className="label">{t("expenses.fieldPaymentMethod")}</label><select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="cash">{t("common.paymentMethods.cash")}</option>
                <option value="card">{t("common.paymentMethods.card")}</option>
                <option value="bank">{t("common.paymentMethods.bank")}</option>
                <option value="cheque">{t("common.paymentMethods.cheque")}</option>
                <option value="credit">{t("expenses.notPaidYet")}</option>
              </select>
              {form.paymentMethod === "credit" && <p className="text-xs text-amber-600 mt-1">{t("expenses.notPaidYetHint")}</p>}
              </div>
              <p className="sm:col-span-2 -mt-2 text-xs text-slate-400">{t("expenses.shopHint")}</p>
              <div className="sm:col-span-2"><label className="label">{t("expenses.fieldDescription")}</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("expenses.descriptionPlaceholder")} /></div>
              <div className={isSplit ? "sm:col-span-2" : ""}><label className="label">{t("expenses.fieldCategory")}</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORY_KEYS.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}</select>
                {form.category === "purchaseOrder" && <p className="text-xs text-sky-700 mt-1">{t("expenses.stockPurchaseHint")}</p>}</div>
              {isSplit ? (
                <div className="sm:col-span-2 space-y-2">
                  <label className="label">{t("expenses.vatLinesLabel")}</label>
                  {form.vatLines.map((l, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex-1"><label className="text-xs text-slate-500">{t("expenses.fieldNet")}</label><input type="number" step="any" inputMode="decimal" className="input" value={l.net} onChange={(e) => updLine(i, { net: e.target.value })} /></div>
                      <div className="w-24"><label className="text-xs text-slate-500">{t("expenses.fieldVatRate")}</label><select className="input" value={l.rate} onChange={(e) => updLine(i, { rate: Number(e.target.value) })}>{VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
                      <div className="w-24 text-right text-sm text-slate-600 pb-2.5">{t("common.vat")} {money(l.vat)}</div>
                      <button type="button" onClick={() => removeLine(i)} className="btn-ghost !px-2 !py-2 text-red-500"><Icon name="trash" size={14} /></button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => setForm(withLines(form, [...form.vatLines, { rate: 19, net: "" }]))} className="btn-ghost text-sm"><Icon name="plus" size={14} /> {t("expenses.addVatLine")}</button>
                    <span className="text-sm text-slate-600">{t("expenses.fieldNet")} {money(form.net)} · {t("common.vat")} {money(form.vat)}</span>
                  </div>
                </div>
              ) : (
                <>
                <div>
                  <label className="label">{t("expenses.fieldVatRate")}</label>
                  <select className="input" value={form.vatRate} onChange={(e) => updVatRate(e.target.value)}>
                    {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    <option value="custom">{t("expenses.vatRateCustom")}</option>
                  </select>
                </div>
                <div><label className="label">{t("expenses.fieldNet")}</label><input type="number" step="any" inputMode="decimal" className="input" value={form.net} onChange={(e) => updNet(e.target.value)} /></div>
                <div>
                  <label className="label">{t("common.vat")}</label>
                  <input
                    type="number" step="any" inputMode="decimal" className="input" value={form.vat}
                    onChange={(e) => setForm({ ...form, vat: e.target.value, vatRate: "custom", _basis: "net", amount: round2(Number(form.net) + Number(e.target.value)) })}
                  />
                </div>
                    <button type="button" onClick={splitVat} className="sm:col-span-2 -mt-2 text-left text-xs text-brand-700 hover:underline">+ {t("expenses.splitVat")}</button>
                </>
              )}
              <div className="sm:col-span-2">
                <label className="label">{t("expenses.fieldInvoice")}</label>
                {form.attachment ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                    <a href={downloadHref(form.attachment.url, form.attachment.name) || form.attachment.data} download={form.attachment.name} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline flex items-center gap-2 truncate">
                      <Icon name="invoice" size={15} className="shrink-0" /> <span className="truncate">{form.attachment.name}</span>
                    </a>
                    <button type="button" onClick={() => setForm({ ...form, attachment: null })} className="btn-ghost !px-2 !py-1 text-red-500 shrink-0"><Icon name="trash" size={14} /></button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary w-full justify-center">
                      <Icon name="upload" size={15} /> {uploading ? t("common.saving") : t("expenses.attachInvoice")}
                    </button>
                    <p className="text-xs text-amber-600 mt-1">{t("expenses.noReceiptHint")}</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onAttach} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t("expenses.fieldAccount")}</label>
                <select className="input" value={form.accountId || ""} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  <option value="">
                    {t("expenses.accountFromCategory")}
                    {autoAccountFor(form.category) ? ` — ${autoAccountFor(form.category).number} ${accName(autoAccountFor(form.category))}` : ""}
                  </option>
                  {accounts.filter((a) => a.type === "expense" && a.active !== false).map((a) => (
                    <option key={a.id} value={a.id}>{a.number} — {accName(a)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="btn-secondary">{t("common.cancel")}</button>
              {!form.id && <button onClick={() => save(true)} disabled={saving} className="btn-secondary">{t("expenses.saveAndNew")}</button>}
              <button onClick={() => save(false)} disabled={saving} className="btn-primary">{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      <ReviewDialog
        open={!!checks}
        title={t("review.expTitle")}
        checks={checks || []}
        busy={saving}
        confirmLabel={t("review.saveAnyway")}
        onCancel={() => setChecks(null)}
        onConfirm={() => commitSave(addAnother)}
      />

      {payForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => !paying && setPayForm(null)}>
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">{t("purchases.recordPayment")}</h2>
            <p className="text-sm text-slate-500 mb-4">{payForm.expense.description}</p>

            <label className="label">{t("common.amount")}</label>
            <input type="number" step="any" min="0" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />

            <label className="label mt-3">{t("expenses.fieldPaymentMethod")}</label>
            <div className="grid grid-cols-2 gap-2">
              {["cash", "bank"].map((m) => (
                <button key={m} type="button" onClick={() => setPayForm({ ...payForm, method: m })} className={`py-2 rounded-lg text-sm font-semibold border-2 ${payForm.method === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>
                  {t(`common.paymentMethods.${m}`)}
                </button>
              ))}
            </div>

            <label className="label mt-3">{t("purchases.date")}</label>
            <input type="date" className="input" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPayForm(null)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={submitPay} disabled={paying} className="btn-primary">{paying ? t("common.saving") : t("purchases.recordPayment")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesInner />
    </Suspense>
  );
}
