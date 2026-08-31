"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { DEFAULT_QUANTITY_DISCOUNT_TIERS } from "@/lib/pricing";
import { testPrint, listPrinters, testOpenDrawer } from "@/lib/receiptPrinter";

const QTY_DISCOUNT_PRODUCT_TYPES = [
  ["cosmetic", "typeCosmetic"],
  ["consumable", "typeConsumable"],
];

export default function SettingsPage() {
  const { t, lang } = useLanguage();
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const restoreRef = useRef();
  const [staff, setStaff] = useState([]);
  const [newStaff, setNewStaff] = useState({ username: "", password: "", role: "cashier", canDiscount: false, linkedId: "" });
  const [staffError, setStaffError] = useState("");
  const [qtyDiscountType, setQtyDiscountType] = useState("cosmetic");
  const [partnerShops, setPartnerShops] = useState([]);
  const [consignmentStores, setConsignmentStores] = useState([]);

  const loadStaff = () => fetch("/api/users").then((r) => (r.ok ? r.json() : [])).then(setStaff);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setS);
    loadStaff();
    fetch("/api/partner-shops").then((r) => (r.ok ? r.json() : [])).then(setPartnerShops);
    fetch("/api/consignment-stores").then((r) => (r.ok ? r.json() : [])).then(setConsignmentStores);
  }, []);

  const LINKED_ENTITIES = { partner: partnerShops, consignment: consignmentStores };

  const addStaff = async () => {
    setStaffError("");
    if (!newStaff.username.trim() || !newStaff.password) { setStaffError(t("settings.errStaffFields")); return; }
    if (LINKED_ENTITIES[newStaff.role] && !newStaff.linkedId) { setStaffError(t("settings.errLinkedEntityRequired")); return; }
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStaff) });
    if (res.ok) { setNewStaff({ username: "", password: "", role: "cashier", canDiscount: false, linkedId: "" }); loadStaff(); }
    else { const err = await res.json().catch(() => ({})); setStaffError(err.error === "errors.usernameTaken" ? t("settings.errUsernameTaken") : err.error === "errors.linkedEntityRequired" ? t("settings.errLinkedEntityRequired") : t("common.error")); }
  };
  const removeStaff = async (id) => {
    if (!confirm(t("settings.confirmRemoveStaff"))) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    loadStaff();
  };

  // Κράτα το τοπικό αντίγραφο συγχρονισμένο με τη γλώσσα του context,
  // ώστε το "Αποθήκευση ρυθμίσεων" να μην ξαναγράφει παλιά τιμή γλώσσας.
  useEffect(() => {
    setS((prev) => (prev ? { ...prev, language: lang } : prev));
  }, [lang]);

  const upd = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const updMail = (patch) => setS((prev) => ({ ...prev, mail: { ...(prev.mail || {}), ...patch } }));
  const updReceiptPrinter = (patch) => setS((prev) => ({ ...prev, receiptPrinter: { ...(prev.receiptPrinter || {}), ...patch } }));

  const [printTesting, setPrintTesting] = useState(false);
  const [printTestResult, setPrintTestResult] = useState(null);
  const runTestPrint = async () => {
    setPrintTesting(true);
    setPrintTestResult(null);
    const res = await testPrint({ settings: s });
    setPrintTestResult(res);
    setPrintTesting(false);
  };

  const [drawerTesting, setDrawerTesting] = useState(false);
  const [drawerTestResult, setDrawerTestResult] = useState(null);
  const runTestDrawer = async () => {
    setDrawerTesting(true);
    setDrawerTestResult(null);
    const res = await testOpenDrawer({ settings: s });
    setDrawerTestResult(res);
    setDrawerTesting(false);
  };

  const [printersListing, setPrintersListing] = useState(false);
  const [printersResult, setPrintersResult] = useState(null);
  const runListPrinters = async () => {
    setPrintersListing(true);
    setPrintersResult(null);
    const res = await listPrinters({ settings: s });
    setPrintersResult(res);
    setPrintersListing(false);
  };

  const getTiers = (type) => {
    const custom = s?.quantityDiscounts?.[type];
    if (Array.isArray(custom)) return custom;
    return DEFAULT_QUANTITY_DISCOUNT_TIERS[type] || [];
  };
  const setTiers = (type, tiers) => {
    setS((prev) => ({ ...prev, quantityDiscounts: { ...(prev.quantityDiscounts || {}), [type]: tiers } }));
  };
  const addTier = (type) => {
    const tiers = [...getTiers(type), { min: 0, percent: 0 }];
    setTiers(type, tiers);
  };
  const updTier = (type, idx, patch) => {
    const tiers = getTiers(type).map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setTiers(type, tiers);
  };
  const removeTier = (type, idx) => {
    const tiers = getTiers(type).filter((_, i) => i !== idx);
    setTiers(type, tiers);
  };

  const [saveError, setSaveError] = useState("");
  const save = async () => {
    setSaveError("");
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error ? t(err.error) : `${t("common.error")} (HTTP ${res.status})`);
        return;
      }
      const fresh = await res.json();
      setS(fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e?.message || t("common.error"));
    }
  };

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => upd({ logo: reader.result });
    reader.readAsDataURL(file);
  };

  const backup = () => {
    fetch("/api/settings"); // ensure db exists
    const a = document.createElement("a");
    // Κατεβάζουμε ολόκληρη τη βάση μέσω ενός βοηθητικού endpoint
    a.href = "/api/backup";
    a.download = `logistiko-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const onRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset ώστε να ξαναδέχεται το ίδιο αρχείο
    if (!file) return;
    if (!confirm(t("settings.restoreConfirm"))) return;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { alert(t("errors.invalidBackup")); return; }
    const res = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) { alert(t("settings.restoreDone")); window.location.reload(); }
    else { const err = await res.json().catch(() => ({})); alert(err.error ? t(err.error) : t("errors.invalidBackup")); }
  };

  if (!s) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800">{t("settings.title")}</h1>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">{t("settings.languageSection")}</h2>
          <LanguageSwitcher variant="light" />
        </div>
        <p className="text-sm text-slate-500">{t("settings.languageDescription")}</p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-700">{t("settings.companySection")}</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
            {s.logo ? <img src={s.logo} alt="logo" className="max-w-full max-h-full" /> : <Icon name="invoice" size={28} className="text-slate-300" />}
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn-secondary">{t("settings.uploadLogo")}</button>
            {s.logo && <button onClick={() => upd({ logo: "" })} className="btn-ghost text-red-600">{t("settings.removeLogo")}</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="label">{t("settings.fieldCompanyName")}</label><input className="input" value={s.companyName} onChange={(e) => upd({ companyName: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldTaxId")}</label><input className="input" value={s.afm} onChange={(e) => upd({ afm: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldAddress")}</label><input className="input" value={s.address} onChange={(e) => upd({ address: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldCity")}</label><input className="input" value={s.city} onChange={(e) => upd({ city: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldPostalCode")}</label><input className="input" value={s.postalCode} onChange={(e) => upd({ postalCode: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldPhone")}</label><input className="input" value={s.phone} onChange={(e) => upd({ phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">{t("settings.fieldEmail")}</label><input className="input" value={s.email} onChange={(e) => upd({ email: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-700">{t("settings.bankSection")}</h2>
        <p className="text-sm text-slate-500">{t("settings.bankDescription")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="label">{t("settings.fieldBankName")}</label><input className="input" value={s.bankName || ""} onChange={(e) => upd({ bankName: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldBankAccountHolder")}</label><input className="input" value={s.bankAccountHolder || ""} onChange={(e) => upd({ bankAccountHolder: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldBankIban")}</label><input className="input" value={s.bankIban || ""} onChange={(e) => upd({ bankIban: e.target.value })} placeholder="CY00 0000 0000 0000 0000 0000 0000" /></div>
          <div><label className="label">{t("settings.fieldBankSwift")}</label><input className="input" value={s.bankSwift || ""} onChange={(e) => upd({ bankSwift: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">{t("settings.fieldBankConfirmationEmail")}</label><input type="email" className="input" value={s.bankConfirmationEmail || ""} onChange={(e) => upd({ bankConfirmationEmail: e.target.value })} placeholder="payments@yourcompany.com" /></div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-700">{t("settings.invoiceSection")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">{t("settings.fieldDefaultVat")}</label><input type="number" step="any" className="input" value={s.vatRate} onChange={(e) => upd({ vatRate: Number(e.target.value) })} /></div>
          <div><label className="label">{t("settings.fieldCurrency")}</label><input className="input" value={s.currency} onChange={(e) => upd({ currency: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldReceiptPrefix")}</label><input className="input" value={s.receiptPrefix} onChange={(e) => upd({ receiptPrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldInvoicePrefix")}</label><input className="input" value={s.invoicePrefix} onChange={(e) => upd({ invoicePrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldCreditPrefix")}</label><input className="input" value={s.creditPrefix} onChange={(e) => upd({ creditPrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldTenderPrefix")}</label><input className="input" value={s.tenderPrefix} onChange={(e) => upd({ tenderPrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldOrderPrefix")}</label><input className="input" value={s.orderPrefix} onChange={(e) => upd({ orderPrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldPurchasePrefix")}</label><input className="input" value={s.purchasePrefix} onChange={(e) => upd({ purchasePrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldSeries")}</label><input className="input" value={s.series} onChange={(e) => upd({ series: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">{t("settings.fieldFooterNote")}</label><input className="input" value={s.footerNote} onChange={(e) => upd({ footerNote: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-700">{t("settings.mailSection")}</h2>
        <p className="text-sm text-slate-500">{t("settings.mailDescription")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">{t("settings.fieldMailHost")}</label><input className="input" value={s.mail?.host || ""} onChange={(e) => updMail({ host: e.target.value })} placeholder="smtp.gmail.com" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">{t("settings.fieldMailPort")}</label><input type="number" className="input" value={s.mail?.port ?? 587} onChange={(e) => updMail({ port: Number(e.target.value) })} /></div>
            <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.mail?.secure} onChange={(e) => updMail({ secure: e.target.checked })} /> {t("settings.fieldMailSecure")}</label></div>
          </div>
          <div><label className="label">{t("settings.fieldMailUser")}</label><input className="input" value={s.mail?.user || ""} onChange={(e) => updMail({ user: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldMailPass")}</label><input type="password" className="input" value={s.mail?.pass || ""} onChange={(e) => updMail({ pass: e.target.value })} placeholder="••••••••" /></div>
          <div><label className="label">{t("settings.fieldMailFromName")}</label><input className="input" value={s.mail?.fromName || ""} onChange={(e) => updMail({ fromName: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldMailFromEmail")}</label><input className="input" value={s.mail?.fromEmail || ""} onChange={(e) => updMail({ fromEmail: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-700">{t("settings.receiptPrinterSection")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("settings.receiptPrinterDesc")}</p>
        </div>
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm text-brand-800 space-y-1">
          <p className="font-medium">{t("settings.receiptPrinterSetupTitle")}</p>
          <ol className="list-decimal list-inside space-y-0.5 text-brand-700">
            <li>{t("settings.receiptPrinterSetup1")}</li>
            <li>{t("settings.receiptPrinterSetup2")}</li>
            <li>{t("settings.receiptPrinterSetup3")}</li>
          </ol>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-900 space-y-1">
          <p className="font-medium">{t("settings.receiptPrinterRemoteTitle")}</p>
          <ol className="list-decimal list-inside space-y-0.5 text-amber-800">
            <li>{t("settings.receiptPrinterRemote1")}</li>
            <li>{t("settings.receiptPrinterRemote2")}</li>
            <li>{t("settings.receiptPrinterRemote3")}</li>
            <li>{t("settings.receiptPrinterRemote4")}</li>
            <li>{t("settings.receiptPrinterRemote5")}</li>
          </ol>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
          <input type="checkbox" checked={!!s.receiptPrinter?.enabled} onChange={(e) => updReceiptPrinter({ enabled: e.target.checked })} />
          {t("settings.receiptPrinterEnable")}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("settings.receiptPrinterName")}</label>
            <input className="input" value={s.receiptPrinter?.name || ""} onChange={(e) => updReceiptPrinter({ name: e.target.value })} placeholder="EPSON TM-T20III Receipt" />
            <p className="text-xs text-slate-400 mt-1">{t("settings.receiptPrinterNameHint")}</p>
          </div>
          <div>
            <label className="label">{t("settings.receiptPrinterWidth")}</label>
            <select className="input" value={s.receiptPrinter?.widthMm || 80} onChange={(e) => updReceiptPrinter({ widthMm: Number(e.target.value) })}>
              <option value={58}>58mm</option>
              <option value={80}>80mm</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("settings.receiptPrinterHost")}</label>
            <input className="input" value={s.receiptPrinter?.host || ""} onChange={(e) => updReceiptPrinter({ host: e.target.value })} placeholder="192.168.1.50" />
            <p className="text-xs text-slate-400 mt-1">{t("settings.receiptPrinterHostHint")}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!s.receiptPrinter?.openCashDrawer} onChange={(e) => updReceiptPrinter({ openCashDrawer: e.target.checked })} />
          {t("settings.receiptPrinterDrawer")}
        </label>
        <p className="text-xs text-slate-400 -mt-2">{t("settings.receiptPrinterDrawerHint")}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={runTestPrint} disabled={printTesting || !s.receiptPrinter?.name} className="btn-secondary"><Icon name="printer" size={15} /> {printTesting ? t("common.loading") : t("settings.receiptPrinterTestBtn")}</button>
          {printTestResult && (
            printTestResult.ok
              ? <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><Icon name="check" size={15} /> {t("settings.receiptPrinterTestOk")}</span>
              : <span className="text-red-600 text-sm font-medium">{t("settings.receiptPrinterTestFail")}: {printTestResult.error}</span>
          )}
        </div>
        {s.receiptPrinter?.openCashDrawer && (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={runTestDrawer} disabled={drawerTesting || !s.receiptPrinter?.name} className="btn-secondary"><Icon name="box" size={15} /> {drawerTesting ? t("common.loading") : t("settings.receiptPrinterTestDrawerBtn")}</button>
            {drawerTestResult && (
              drawerTestResult.ok
                ? <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><Icon name="check" size={15} /> {t("settings.receiptPrinterTestOk")}</span>
                : <span className="text-red-600 text-sm font-medium">{t("settings.receiptPrinterTestFail")}: {drawerTestResult.error}</span>
            )}
          </div>
        )}
        <div className="space-y-2">
          <button onClick={runListPrinters} disabled={printersListing} className="btn-secondary"><Icon name="search" size={15} /> {printersListing ? t("common.loading") : t("settings.receiptPrinterListBtn")}</button>
          <p className="text-xs text-slate-400">{t("settings.receiptPrinterListHint")}</p>
          {printersResult && (
            printersResult.ok ? (
              printersResult.list.length === 0 ? (
                <p className="text-sm text-red-600">{t("settings.receiptPrinterListEmpty")}</p>
              ) : (
                <ul className="text-sm bg-slate-50 rounded-lg p-3 space-y-1">
                  {printersResult.list.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-2">
                      <code className="text-slate-700">{name}</code>
                      <button onClick={() => updReceiptPrinter({ name })} className="btn-ghost !px-2 !py-0.5 text-xs text-brand-700">{t("settings.receiptPrinterListUse")}</button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <span className="text-sm text-red-600">{t("settings.receiptPrinterTestFail")}: {printersResult.error}</span>
            )
          )}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-700">{t("settings.staffSection")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("settings.staffDescription")}</p>
        </div>

        {staffError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{staffError}</div>}

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="label">{t("settings.fieldUsername")}</label>
            <input className="input" value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="label">{t("settings.fieldPassword")}</label>
            <input type="password" className="input" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} />
          </div>
          <div className="min-w-[140px]">
            <label className="label">{t("settings.fieldRole")}</label>
            <select className="input" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value, linkedId: "" })}>
              <option value="cashier">{t("settings.roleCashier")}</option>
              <option value="manager">{t("settings.roleManager")}</option>
              <option value="partner">{t("settings.rolePartner")}</option>
              <option value="consignment">{t("settings.roleConsignment")}</option>
              <option value="accountant">{t("settings.roleAccountant")}</option>
            </select>
          </div>
          {LINKED_ENTITIES[newStaff.role] && (
            <div className="min-w-[160px]">
              <label className="label">{t("settings.fieldLinkedEntity")}</label>
              <select className="input" value={newStaff.linkedId} onChange={(e) => setNewStaff({ ...newStaff, linkedId: e.target.value })}>
                <option value="">{t("settings.selectLinkedEntity")}</option>
                {LINKED_ENTITIES[newStaff.role].map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={addStaff} className="btn-secondary"><Icon name="plus" size={15} /> {t("settings.addStaff")}</button>
        </div>
        {newStaff.role === "cashier" && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={newStaff.canDiscount} onChange={(e) => setNewStaff({ ...newStaff, canDiscount: e.target.checked })} />
            {t("settings.canDiscountLabel")}
          </label>
        )}

        {staff.length === 0 ? (
          <p className="text-sm text-slate-400">{t("settings.noStaff")}</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr><th className="table-th">{t("settings.fieldUsername")}</th><th className="table-th">{t("settings.fieldRole")}</th><th className="table-th"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((u) => {
                  const roleLabel = u.role === "manager" ? t("settings.roleManager")
                    : u.role === "partner" ? t("settings.rolePartner")
                    : u.role === "consignment" ? t("settings.roleConsignment")
                    : u.role === "accountant" ? t("settings.roleAccountant")
                    : t("settings.roleCashier");
                  return (
                  <tr key={u.id}>
                    <td className="table-td font-medium">{u.username}</td>
                    <td className="table-td text-slate-500">
                      {roleLabel}{u.role === "cashier" && u.canDiscount ? ` · ${t("settings.canDiscountBadge")}` : ""}
                      {u.linkedName ? ` · ${u.linkedName}` : ""}
                    </td>
                    <td className="table-td text-right"><button onClick={() => removeStaff(u.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={14} /></button></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-700">{t("settings.qtyDiscountSection")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("settings.qtyDiscountSectionDesc")}</p>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          {QTY_DISCOUNT_PRODUCT_TYPES.map(([type, key]) => (
            <button
              key={type}
              onClick={() => setQtyDiscountType(type)}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${qtyDiscountType === type ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}
            >
              {t(`stock.${key}`)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {getTiers(qtyDiscountType).map((tier, idx) => (
            <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded-lg">
              <div className="flex-1">
                <label className="label">{t("settings.qtyDiscountMinLabel")}</label>
                <input type="number" step="1" min="0" className="input" value={tier.min} onChange={(e) => updTier(qtyDiscountType, idx, { min: Number(e.target.value) })} />
              </div>
              <div className="flex-1">
                <label className="label">{t("settings.qtyDiscountPercentLabel")}</label>
                <input type="number" step="any" min="0" max="100" className="input" value={tier.percent} onChange={(e) => updTier(qtyDiscountType, idx, { percent: Number(e.target.value) })} />
              </div>
              <button onClick={() => removeTier(qtyDiscountType, idx)} className="btn-ghost text-red-600"><Icon name="trash" size={16} /></button>
            </div>
          ))}
          {getTiers(qtyDiscountType).length === 0 && (
            <p className="text-sm text-slate-400 italic">{t("settings.qtyDiscountNoTiers")}</p>
          )}
        </div>

        <button onClick={() => addTier(qtyDiscountType)} className="btn-secondary"><Icon name="plus" size={15} /> {t("settings.qtyDiscountAddTier")}</button>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-slate-700">{t("settings.backupSection")}</h2>
        <p className="text-sm text-slate-500">{t("settings.backupDescription")}</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={backup} className="btn-secondary"><Icon name="download" size={15} /> {t("settings.downloadBackup")}</button>
          <button onClick={() => restoreRef.current?.click()} className="btn-secondary"><Icon name="refresh" size={15} /> {t("settings.restoreBackup")}</button>
          <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestore} />
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-4 flex-wrap">
        <button onClick={save} className="btn-primary">{t("settings.saveSettings")}</button>
        {saved && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><Icon name="check" size={15} /> {t("common.saved")}</span>}
        {saveError && <span className="text-red-600 text-sm font-medium bg-red-50 rounded-lg px-3 py-1.5">{saveError}</span>}
      </div>
    </div>
  );
}
