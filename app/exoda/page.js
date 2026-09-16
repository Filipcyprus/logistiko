"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { money, formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import ReviewDialog from "@/components/ReviewDialog";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const CATEGORY_KEYS = ["rawMaterials", "ink", "rent", "utilities", "payroll", "equipment", "shipping", "marketing", "general", "purchaseOrder"];
const empty = { date: todayISO(), category: "general", description: "", supplier: "", net: 0, vat: 0, amount: 0, paymentMethod: "cash", accountId: "" };

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
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [checks, setChecks] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [paying, setPaying] = useState(false);

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
    shipping: "expShipping", marketing: "expMarketing",
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

  const filtered = expenses.filter((e) => !month || (e.date || "").startsWith(month));
  const total = filtered.reduce((a, x) => a + Number(x.amount || 0), 0);
  const categoryLabel = (key) => t(`expenses.categories.${key}`) || key;
  const defaultVatRate = settings?.vatRate ?? 19;

  const updNet = (net) => {
    const vat = form.vatIncluded ? form.vat : Math.round(Number(net) * (defaultVatRate / 100) * 100) / 100;
    setForm({ ...form, net, vat, amount: Math.round((Number(net) + Number(vat)) * 100) / 100 });
  };

  // Έλεγχος πριν μπει το έξοδο στα βιβλία. Πιάνει τα λάθη που δεν φαίνονται μετά: ποσό χωρίς ΦΠΑ
  // που δεν θα συμψηφιστεί ποτέ, καθαρό+ΦΠΑ που δεν βγάζει το σύνολο, διπλοκαταχώριση του ίδιου
  // τιμολογίου, ημερομηνία στο μέλλον.
  const expenseChecks = () => {
    const out = [];
    const net = Number(form.net || 0);
    const vat = Number(form.vat || 0);
    const amount = Number(form.amount || 0);

    if (!form.description.trim()) out.push({ level: "error", text: t("review.expNeedDescription") });
    if (amount <= 0) out.push({ level: "error", text: t("review.expNeedAmount") });
    if (form.date > todayISO()) out.push({ level: "error", text: t("review.dateInFuture") });

    if (round2(net + vat) !== round2(amount)) {
      out.push({ level: "warn", text: t("review.expTotalMismatch", { sum: money(round2(net + vat)), total: money(amount) }) });
    }
    if (amount > 0 && !vat) out.push({ level: "warn", text: t("review.expNoVat") });
    if (!form.supplier.trim()) out.push({ level: "warn", text: t("review.expNoSupplier") });

    const dup = expenses.find((e) => e.id !== form.id && e.date === form.date && round2(e.amount) === round2(amount) && (e.supplier || "") === (form.supplier || ""));
    if (dup) out.push({ level: "warn", text: t("review.expDuplicate", { number: dup.number || "", description: dup.description }) });

    const acc = form.accountId ? accounts.find((a) => a.id === form.accountId) : autoAccountFor(form.category);
    if (acc) out.push({ level: "info", text: t("review.expAccount", { account: `${acc.number} ${accName(acc)}` }) });
    if (form.paymentMethod === "credit") out.push({ level: "info", text: t("review.expUnpaid") });

    return out;
  };

  const save = () => {
    const found = expenseChecks();
    if (found.length > 0) { setChecks(found); return; }
    commitSave();
  };

  const commitSave = async () => {
    setSaving(true);
    // Σύνδεσε το ελεύθερο όνομα προμηθευτή με την καρτέλα του, όταν ταιριάζει — έτσι ένα απλήρωτο
    // τιμολόγιο μπορεί να εξοφληθεί αργότερα και να μπει στην ενηλικίωση υπολοίπων.
    const matched = suppliers.find((s) => s.name.trim().toLowerCase() === (form.supplier || "").trim().toLowerCase());
    const payload = { ...form, supplierId: matched?.id || null };
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/expenses/${form.id}` : "/api/expenses";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setChecks(null); setForm(null); setSaving(false); load();
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
          ? <button onClick={() => setForm({ ...empty })} className="btn-primary"><Icon name="plus" size={16} /> {t("expenses.newExpense")}</button>
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
                      <td className="table-td text-right">{money(e.vat)}</td>
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
                          <a href={e.attachment.data} download={e.attachment.name} title={t("expenses.viewInvoice")} className="btn-ghost !px-2 !py-1 inline-flex"><Icon name="download" size={15} /></a>
                        )}
                        {e.purchaseOrderId && (
                          <Link href={`/agores/${e.purchaseOrderId}`} title={t("expenses.viewPO")} className="btn-ghost !px-2 !py-1 inline-flex"><Icon name="external" size={15} /></Link>
                        )}
                        <button onClick={() => setForm({ ...empty, ...e })} className="btn-ghost !px-2 !py-1"><Icon name="edit" size={15} /></button>
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
                  const total = round2((po.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unitCost || 0), 0));
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
              <div><label className="label">{t("expenses.fieldDate")}</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="label">{t("expenses.fieldCategory")}</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORY_KEYS.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}</select></div>
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
              <div className="sm:col-span-2"><label className="label">{t("expenses.fieldDescription")}</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="label">{t("expenses.fieldSupplier")}</label><input className="input" list="supplier-list" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /><datalist id="supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist></div>
              <div><label className="label">{t("expenses.fieldPaymentMethod")}</label><select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="cash">{t("common.paymentMethods.cash")}</option>
                <option value="card">{t("common.paymentMethods.card")}</option>
                <option value="bank">{t("common.paymentMethods.bank")}</option>
                <option value="cheque">{t("common.paymentMethods.cheque")}</option>
                <option value="credit">{t("expenses.notPaidYet")}</option>
              </select>
              {form.paymentMethod === "credit" && <p className="text-xs text-amber-600 mt-1">{t("expenses.notPaidYetHint")}</p>}
              </div>
              <div><label className="label">{t("expenses.fieldNet")}</label><input type="number" step="any" className="input" value={form.net} onChange={(e) => updNet(e.target.value)} /></div>
              <div><label className="label">{t("common.vat")}</label><input type="number" step="any" className="input" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value, amount: Math.round((Number(form.net) + Number(e.target.value)) * 100) / 100 })} /></div>
              <div className="sm:col-span-2"><label className="label">{t("expenses.fieldTotal")}</label><input type="number" step="any" className="input font-semibold" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? t("common.saving") : t("common.save")}</button>
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
        onConfirm={commitSave}
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
