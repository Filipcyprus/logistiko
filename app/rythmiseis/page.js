"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function SettingsPage() {
  const { t, lang } = useLanguage();
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const restoreRef = useRef();

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setS);
  }, []);

  // Κράτα το τοπικό αντίγραφο συγχρονισμένο με τη γλώσσα του context,
  // ώστε το "Αποθήκευση ρυθμίσεων" να μην ξαναγράφει παλιά τιμή γλώσσας.
  useEffect(() => {
    setS((prev) => (prev ? { ...prev, language: lang } : prev));
  }, [lang]);

  const upd = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const updMail = (patch) => setS((prev) => ({ ...prev, mail: { ...(prev.mail || {}), ...patch } }));

  const save = async () => {
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <h2 className="font-semibold text-slate-700">{t("settings.invoiceSection")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">{t("settings.fieldDefaultVat")}</label><input type="number" step="any" className="input" value={s.vatRate} onChange={(e) => upd({ vatRate: Number(e.target.value) })} /></div>
          <div><label className="label">{t("settings.fieldCurrency")}</label><input className="input" value={s.currency} onChange={(e) => upd({ currency: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldReceiptPrefix")}</label><input className="input" value={s.receiptPrefix} onChange={(e) => upd({ receiptPrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldInvoicePrefix")}</label><input className="input" value={s.invoicePrefix} onChange={(e) => upd({ invoicePrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldCreditPrefix")}</label><input className="input" value={s.creditPrefix} onChange={(e) => upd({ creditPrefix: e.target.value })} /></div>
          <div><label className="label">{t("settings.fieldQuotePrefix")}</label><input className="input" value={s.quotePrefix} onChange={(e) => upd({ quotePrefix: e.target.value })} /></div>
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

      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-slate-700">{t("settings.backupSection")}</h2>
        <p className="text-sm text-slate-500">{t("settings.backupDescription")}</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={backup} className="btn-secondary"><Icon name="download" size={15} /> {t("settings.downloadBackup")}</button>
          <button onClick={() => restoreRef.current?.click()} className="btn-secondary"><Icon name="refresh" size={15} /> {t("settings.restoreBackup")}</button>
          <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestore} />
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-4">
        <button onClick={save} className="btn-primary">{t("settings.saveSettings")}</button>
        {saved && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><Icon name="check" size={15} /> {t("common.saved")}</span>}
      </div>
    </div>
  );
}
