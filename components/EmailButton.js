"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Κουμπί + modal για αποστολή εγγράφου με email.
export default function EmailButton({ kind, id, defaultEmail = "" }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultEmail);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    const res = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, to }) });
    setSending(false);
    if (res.ok) { setOpen(false); alert(t("email.sent")); }
    else { const err = await res.json().catch(() => ({})); alert(err.error ? t(err.error) : t("errors.emailFailed")); }
  };

  return (
    <>
      <button onClick={() => { setTo(defaultEmail); setOpen(true); }} className="btn-secondary"><Icon name="external" size={15} /> {t("email.button")}</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print" onClick={() => setOpen(false)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{t("email.title")}</h2>
            <label className="label">{t("email.recipient")}</label>
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" autoFocus />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-secondary">{t("common.cancel")}</button>
              <button onClick={send} disabled={sending || !to.trim()} className="btn-primary">{sending ? t("email.sending") : t("email.send")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
