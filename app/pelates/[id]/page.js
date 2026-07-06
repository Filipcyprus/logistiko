"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const emptyCust = { name: "", afm: "", profession: "", address: "", city: "", phone: "", email: "", priceListName: "", defaultDiscount: 0, creditDays: 0, notes: "" };

// Χρωματισμός ετικέτας βάσει ονόματος
function tagColor(tag) {
  const colors = ["bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-slate-100 text-slate-600"];
  let h = 0; for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % colors.length;
  return colors[h];
}

export default function CustomerProfile() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [products, setProducts] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("activities");
  const [actType, setActType] = useState("note");
  const [newCP, setNewCP] = useState({ productId: "", price: "" });

  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: 0, method: "cash", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [cust, setCust] = useState(emptyCust);
  const [actForm, setActForm] = useState(null);

  const loadLedger = () => fetch(`/api/customers/${id}/ledger`).then((r) => (r.ok ? r.json() : null)).then((d) => (d ? setData(d) : setNotFound(true)));
  const loadActs = () => fetch(`/api/activities?customerId=${id}`).then((r) => r.json()).then(setActivities);
  useEffect(() => { loadLedger(); loadActs(); fetch("/api/products").then((r) => r.json()).then(setProducts); }, [id]);

  if (notFound) return <div className="text-slate-500">{t("common.notFound")} <Link href="/pelates" className="text-brand-600">{t("common.returnLink")}</Link></div>;
  if (!data) return <div className="text-slate-400">{t("common.loading")}</div>;
  const c = data.customer;

  const savePayment = async () => {
    if (Number(pay.amount) <= 0) { alert(t("customers.errNeedAmount")); return; }
    await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: id, ...pay }) });
    setPayOpen(false); setPay({ amount: 0, method: "cash", date: new Date().toISOString().slice(0, 10), notes: "" });
    loadLedger();
  };

  const openEdit = () => { setCust({ ...emptyCust, ...c }); setEditOpen(true); };
  const saveCust = async () => {
    await fetch(`/api/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cust) });
    setEditOpen(false); loadLedger();
  };

  const saveAct = async () => {
    if (!actForm.title && !actForm.note) { alert(t("customers.errNeedTitleOrNote")); return; }
    const method = actForm.id ? "PUT" : "POST";
    const url = actForm.id ? `/api/activities/${actForm.id}` : "/api/activities";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...actForm, customerId: id, type: actType }) });
    setActForm(null); loadActs();
  };
  const delAct = async (aid) => { if (!confirm(t("customers.confirmDeleteActivity"))) return; await fetch(`/api/activities/${aid}`, { method: "DELETE" }); loadActs(); };
  const toggleDone = async (a) => { await fetch(`/api/activities/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !a.done }) }); loadActs(); };

  const enableB2b = async () => { await fetch(`/api/customers/${id}/b2b`, { method: "POST" }); loadLedger(); };
  const regenB2b = async () => { if (!confirm(t("customers.confirmRegen"))) return; await fetch(`/api/customers/${id}/b2b`, { method: "PUT" }); loadLedger(); };
  const disableB2b = async () => { if (!confirm(t("customers.confirmDisableB2b"))) return; await fetch(`/api/customers/${id}/b2b`, { method: "DELETE" }); loadLedger(); };
  const portalUrl = typeof window !== "undefined" && c.b2bToken ? `${window.location.origin}/portal/${c.b2bToken}` : "";
  const copyToClipboard = (text) => { navigator.clipboard?.writeText(text); };

  const saveCustomPrices = async (next) => {
    await fetch(`/api/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customPrices: next }) });
    loadLedger();
  };
  const addCustomPrice = () => {
    if (!newCP.productId || newCP.price === "") return;
    const next = [...(c.customPrices || []).filter((x) => x.productId !== newCP.productId), { productId: newCP.productId, price: Number(newCP.price) }];
    setNewCP({ productId: "", price: "" });
    saveCustomPrices(next);
  };
  const removeCustomPrice = (productId) => saveCustomPrices((c.customPrices || []).filter((x) => x.productId !== productId));
  const updateCustomPrice = (productId, price) => {
    setData((prev) => ({ ...prev, customer: { ...prev.customer, customPrices: (prev.customer.customPrices || []).map((x) => (x.productId === productId ? { ...x, price } : x)) } }));
  };

  const acts = activities.filter((a) => a.type === actType);

  const TABS = [
    { k: "details", label: t("customers.tabDetails") },
    { k: "activities", label: t("customers.tabActivities") },
    { k: "ledger", label: t("customers.tabLedger") },
    { k: "invoices", label: t("customers.tabInvoices"), badge: data.counts.invoices },
    { k: "orders", label: t("customers.tabOrders"), badge: data.counts.orders },
    { k: "quotes", label: t("customers.tabQuotes"), badge: data.counts.quotes },
    { k: "b2b", label: t("customers.tabB2b") },
  ];

  return (
    <div className="space-y-5">
      <Link href="/pelates" className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1"><Icon name="arrowLeft" size={14} /> {t("customers.backLink")}</Link>

      {/* Banner */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{c.name}</h1>
            {c.priceListName && <span className="badge bg-brand-100 text-brand-700">{t("customers.priceListBadge", { name: c.priceListName })}</span>}
            <span className={`badge ${c.b2bEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{t("customers.b2bBadge")} {c.b2bEnabled ? t("customers.b2bOn") : t("customers.b2bOff")}</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{[c.profession, c.afm && `${t("customers.fieldTaxId")} ${c.afm}`, c.phone, c.email].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-400">{t("customers.grossIncome")}</div>
            <div className="text-2xl font-bold text-slate-800">{money(data.grossIncome)}</div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="badge bg-red-100 text-red-700">{t("customers.debitDays", { count: data.debitDays })}</span>
            <span className="badge bg-emerald-100 text-emerald-700">{t("customers.creditDays", { count: data.creditDays })}</span>
          </div>
          <button onClick={() => setPayOpen(true)} className="btn-primary"><Icon name="money" size={16} /> {t("customers.registerPayment")}</button>
        </div>
      </div>

      {/* Balance strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4"><div className="text-sm text-slate-500">{t("customers.totalCharged")}</div><div className="text-xl font-bold text-slate-800">{money(data.totalCharged)}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">{t("customers.totalPaid")}</div><div className="text-xl font-bold text-emerald-600">{money(data.totalPaid)}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">{t("customers.balance")}</div><div className={`text-xl font-bold ${data.balance > 0 ? "text-amber-600" : "text-slate-800"}`}>{money(data.balance)}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tabItem) => (
          <button key={tabItem.k} onClick={() => setTab(tabItem.k)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${tab === tabItem.k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {tabItem.label}
            {tabItem.badge > 0 && <span className="badge bg-brand-600 text-white !px-1.5 !py-0 text-[10px]">{tabItem.badge}</span>}
          </button>
        ))}
      </div>

      {/* --- ΣΤΟΙΧΕΙΑ --- */}
      {tab === "details" && (
        <div className="card p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="font-semibold text-slate-700">{t("customers.detailsTitle")}</h2>
            <button onClick={openEdit} className="btn-secondary"><Icon name="edit" size={15} /> {t("customers.editButton")}</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              [t("customers.detailName"), c.name], [t("customers.detailProfession"), c.profession], [t("customers.detailTaxId"), c.afm],
              [t("customers.detailPhone"), c.phone], [t("customers.detailEmail"), c.email], [t("customers.detailAddress"), [c.address, c.city].filter(Boolean).join(", ")],
              [t("customers.detailPriceList"), c.priceListName], [t("customers.detailDiscount"), c.defaultDiscount ? `${c.defaultDiscount}%` : "—"], [t("customers.detailCreditDays"), c.creditDays || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-50 pb-1"><span className="text-slate-400">{k}</span><span className="text-slate-700 font-medium text-right">{v || "—"}</span></div>
            ))}
          </div>
          {c.notes && <div className="mt-4 text-sm text-slate-600"><b>{t("customers.notesPrefix")}</b> {c.notes}</div>}
        </div>
      )}

      {/* --- ΔΡΑΣΤΗΡΙΟΤΗΤΕΣ --- */}
      {tab === "activities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1">
              <button onClick={() => setActType("note")} className={actType === "note" ? "btn bg-brand-700 text-white" : "btn-secondary"}>{t("customers.notesTab")}</button>
              <button onClick={() => setActType("reminder")} className={actType === "reminder" ? "btn bg-brand-700 text-white" : "btn-secondary"}>{t("customers.remindersTab")}</button>
            </div>
            <button onClick={() => setActForm({ title: "", note: "", tags: "", date: new Date().toISOString().slice(0, 10), dueDate: "" })} className="btn-primary"><Icon name="plus" size={16} /> {actType === "note" ? t("customers.newNote") : t("customers.newReminder")}</button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{actType === "reminder" ? t("customers.colDue") : t("customers.colDateShort")}</th>
                  <th className="table-th">{t("customers.colTitle")}</th>
                  <th className="table-th">{t("customers.colNote")}</th>
                  <th className="table-th">{t("customers.colTags")}</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {acts.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={5}>{t("customers.noEntries")}</td></tr>
                ) : acts.map((a) => (
                  <tr key={a.id} className={`hover:bg-slate-50 ${a.done ? "opacity-50" : ""}`}>
                    <td className="table-td whitespace-nowrap">
                      {actType === "reminder" && <input type="checkbox" checked={!!a.done} onChange={() => toggleDone(a)} className="mr-2 align-middle" />}
                      {formatDate(actType === "reminder" ? (a.dueDate || a.date) : a.date)}
                    </td>
                    <td className="table-td font-medium">{a.title || "—"}</td>
                    <td className="table-td text-slate-600 max-w-md">{a.note}</td>
                    <td className="table-td"><div className="flex gap-1 flex-wrap">{(a.tags || []).map((tag) => <span key={tag} className={`badge ${tagColor(tag)}`}>{tag}</span>)}</div></td>
                    <td className="table-td text-right whitespace-nowrap">
                      <button onClick={() => { setActForm({ ...a, tags: (a.tags || []).join(", ") }); }} className="btn-ghost !px-2 !py-1"><Icon name="edit" size={14} /></button>
                      <button onClick={() => delAct(a.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ΚΑΡΤΕΛΑ (ledger) --- */}
      {tab === "ledger" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><th className="table-th">{t("customers.ledgerColDate")}</th><th className="table-th">{t("customers.ledgerColMovement")}</th><th className="table-th">{t("customers.ledgerColDescription")}</th><th className="table-th text-right">{t("customers.ledgerColDebit")}</th><th className="table-th text-right">{t("customers.ledgerColCredit")}</th><th className="table-th text-right">{t("customers.ledgerColBalance")}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.entries.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={6}>{t("customers.noMovements")}</td></tr> : data.entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="table-td">{formatDate(e.date)}</td>
                  <td className="table-td font-medium">{e.kind === "invoice" ? <Link href={`/parastatika/${e.id}`} className="text-brand-700 hover:underline">{e.ref}</Link> : t("customers.paymentRef")}</td>
                  <td className="table-td text-slate-500">
                    {e.kind === "invoice"
                      ? (e.invoiceKind === "timologio" ? t("invoices.typeInvoice") : t("invoices.typeReceipt"))
                      : `${t(`common.paymentMethods.${e.method}`) || e.method}${e.notes ? ` — ${e.notes}` : ""}`}
                  </td>
                  <td className="table-td text-right">{e.debit ? money(e.debit) : "—"}</td>
                  <td className="table-td text-right text-emerald-600">{e.credit ? money(e.credit) : "—"}</td>
                  <td className="table-td text-right font-semibold">{money(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- ΛΙΣΤΕΣ ΕΓΓΡΑΦΩΝ --- */}
      {tab === "invoices" && <DocMini rows={data.invoices} href="/parastatika" empty={t("customers.noInvoicesDoc")} t={t} />}
      {tab === "orders" && <DocMini rows={data.orders} href="/paraggelies" empty={t("customers.noOrdersDoc")} t={t} />}
      {tab === "quotes" && <DocMini rows={data.quotes} href="/prosfores" empty={t("customers.noQuotesDoc")} t={t} />}

      {tab === "b2b" && (
        <div className="card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-700">{t("customers.b2bTitle")}</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">{t("customers.b2bDescription")}</p>
            </div>
            {c.b2bEnabled
              ? <button onClick={disableB2b} className="btn-secondary text-red-600">{t("customers.b2bDisable")}</button>
              : <button onClick={enableB2b} className="btn-primary"><Icon name="link" size={16} /> {t("customers.b2bEnable")}</button>}
          </div>

          {c.b2bEnabled && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label className="label">{t("customers.b2bLink")}</label>
                <div className="flex gap-2">
                  <input readOnly className="input font-mono text-xs" value={portalUrl} onClick={(e) => e.target.select()} />
                  <button onClick={() => copyToClipboard(portalUrl)} className="btn-secondary whitespace-nowrap"><Icon name="copy" size={15} /> {t("customers.b2bCopy")}</button>
                  <a href={portalUrl} target="_blank" rel="noreferrer" className="btn-secondary whitespace-nowrap"><Icon name="external" size={15} /> {t("customers.b2bOpen")}</a>
                </div>
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label">{t("customers.b2bPin")}</label>
                  <div className="text-2xl font-bold tracking-widest text-brand-700 bg-brand-50 rounded-lg px-4 py-2 inline-block">{c.b2bPin}</div>
                </div>
                <button onClick={regenB2b} className="btn-secondary"><Icon name="refresh" size={15} /> {t("customers.b2bRegen")}</button>
              </div>
              <p className="text-xs text-slate-400">{t("customers.b2bHint")}</p>

              <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${c.requirePin ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
                    <Icon name="lock" size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-700 text-sm">{t("customers.b2bRequirePin")}</div>
                    <p className="text-xs text-slate-500 mt-0.5">{t("customers.b2bRequirePinHint")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!c.requirePin}
                  onClick={async () => { await fetch(`/api/customers/${id}/b2b`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirePin: !c.requirePin }) }); loadLedger(); }}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400 ${c.requirePin ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${c.requirePin ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-700">{t("customers.cpTitle")}</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-xl">{t("customers.cpDescription")}</p>
                </div>

                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="label">{t("customers.cpAddProduct")}</label>
                    <select className="input" value={newCP.productId} onChange={(e) => setNewCP({ ...newCP, productId: e.target.value })}>
                      <option value="">{t("customers.cpAddProduct")}</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="label">{t("customers.cpFieldPrice")}</label>
                    <input type="number" step="any" className="input" value={newCP.price} onChange={(e) => setNewCP({ ...newCP, price: e.target.value })} />
                  </div>
                  <button onClick={addCustomPrice} className="btn-secondary"><Icon name="plus" size={15} /> {t("customers.cpAdd")}</button>
                </div>

                {(c.customPrices || []).length === 0 ? (
                  <p className="text-sm text-slate-400">{t("customers.cpEmpty")}</p>
                ) : (
                  <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr><th className="table-th">{t("customers.cpColProduct")}</th><th className="table-th text-right">{t("customers.cpColPrice")}</th><th className="table-th"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(c.customPrices || []).map((cp) => {
                          const p = products.find((x) => x.id === cp.productId);
                          return (
                            <tr key={cp.productId}>
                              <td className="table-td font-medium">{p ? p.name : cp.productId}</td>
                              <td className="table-td text-right">
                                <input type="number" step="any" className="input !w-28 !py-1 ml-auto" value={cp.price} onChange={(e) => updateCustomPrice(cp.productId, e.target.value)} onBlur={() => saveCustomPrices(c.customPrices)} />
                              </td>
                              <td className="table-td text-right"><button onClick={() => removeCustomPrice(cp.productId)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {payOpen && (
        <Modal onClose={() => setPayOpen(false)} title={t("customers.payModalTitle", { name: c.name })}>
          <div className="space-y-4">
            <Field label={t("invoices.amount")}><input type="number" step="any" className="input" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label={t("invoices.date")}><input type="date" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
            <Field label={t("invoices.method")}><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              <option value="cash">{t("common.paymentMethods.cash")}</option>
              <option value="card">{t("common.paymentMethods.card")}</option>
              <option value="bank">{t("common.paymentMethods.bank")}</option>
              <option value="cheque">{t("common.paymentMethods.cheque")}</option>
            </select></Field>
            <Field label={t("customers.fieldNote")}><input className="input" value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></Field>
          </div>
          <ModalActions onCancel={() => setPayOpen(false)} onSave={savePayment} saveLabel={t("invoices.register")} cancelLabel={t("common.cancel")} />
        </Modal>
      )}

      {editOpen && (
        <Modal onClose={() => setEditOpen(false)} title={t("customers.modalEdit")} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Field label={t("customers.fieldName")}><input className="input" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></Field></div>
            <Field label={t("customers.fieldTaxId")}><input className="input" value={cust.afm} onChange={(e) => setCust({ ...cust, afm: e.target.value })} /></Field>
            <Field label={t("customers.fieldProfession")}><input className="input" value={cust.profession} onChange={(e) => setCust({ ...cust, profession: e.target.value })} /></Field>
            <Field label={t("customers.fieldPhone")}><input className="input" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></Field>
            <Field label={t("customers.fieldAddress")}><input className="input" value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} /></Field>
            <Field label={t("customers.fieldCity")}><input className="input" value={cust.city} onChange={(e) => setCust({ ...cust, city: e.target.value })} /></Field>
            <Field label={t("customers.fieldEmail")}><input className="input" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></Field>
            <Field label={t("customers.fieldPriceList")}><input className="input" value={cust.priceListName} onChange={(e) => setCust({ ...cust, priceListName: e.target.value })} placeholder={t("customers.priceListPlaceholder")} /></Field>
            <Field label={t("customers.fieldDiscount")}><input type="number" step="any" className="input" value={cust.defaultDiscount} onChange={(e) => setCust({ ...cust, defaultDiscount: e.target.value })} /></Field>
            <Field label={t("customers.fieldCreditDays")}><input type="number" className="input" value={cust.creditDays} onChange={(e) => setCust({ ...cust, creditDays: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label={t("customers.fieldNotes")}><textarea className="input" rows={2} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} /></Field></div>
          </div>
          <ModalActions onCancel={() => setEditOpen(false)} onSave={saveCust} cancelLabel={t("common.cancel")} saveLabel={t("common.save")} />
        </Modal>
      )}

      {actForm && (
        <Modal onClose={() => setActForm(null)} title={actType === "note" ? t("customers.activityModalNote") : t("customers.activityModalReminder")}>
          <div className="space-y-4">
            <Field label={t("customers.fieldTitle")}><input className="input" value={actForm.title} onChange={(e) => setActForm({ ...actForm, title: e.target.value })} /></Field>
            <Field label={t("customers.fieldNote")}><textarea className="input" rows={3} value={actForm.note} onChange={(e) => setActForm({ ...actForm, note: e.target.value })} /></Field>
            {actType === "reminder"
              ? <Field label={t("customers.fieldDue")}><input type="date" className="input" value={actForm.dueDate} onChange={(e) => setActForm({ ...actForm, dueDate: e.target.value })} /></Field>
              : <Field label={t("customers.fieldDate")}><input type="date" className="input" value={actForm.date} onChange={(e) => setActForm({ ...actForm, date: e.target.value })} /></Field>}
            <Field label={t("customers.fieldTags")}><input className="input" value={actForm.tags} onChange={(e) => setActForm({ ...actForm, tags: e.target.value })} placeholder={t("customers.tagsPlaceholder")} /></Field>
          </div>
          <ModalActions onCancel={() => setActForm(null)} onSave={saveAct} cancelLabel={t("common.cancel")} saveLabel={t("common.save")} />
        </Modal>
      )}
    </div>
  );
}

function DocMini({ rows, href, empty, t }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="table-th">{t("documents.colNumber")}</th><th className="table-th">{t("documents.colDate")}</th><th className="table-th text-right">{t("documents.colTotal")}</th><th className="table-th">{t("documents.colStatus")}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {(!rows || rows.length === 0) ? <tr><td className="table-td text-slate-400" colSpan={4}>{empty}</td></tr> : rows.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="table-td font-medium"><Link href={`${href}/${d.id}`} className="text-brand-700 hover:underline">{d.number}</Link></td>
              <td className="table-td">{formatDate(d.date)}</td>
              <td className="table-td text-right font-semibold">{money(d.total)}</td>
              <td className="table-td">{d.status === "paid" ? t("invoices.statusPaid") : d.status === "unpaid" ? t("invoices.statusUnpaid") : d.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`card p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) { return <div><label className="label">{label}</label>{children}</div>; }
function ModalActions({ onCancel, onSave, saveLabel, cancelLabel }) {
  return <div className="flex justify-end gap-2 mt-5"><button onClick={onCancel} className="btn-secondary">{cancelLabel}</button><button onClick={onSave} className="btn-primary">{saveLabel}</button></div>;
}
