"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import Icon from "@/components/Icon";

export default function PortalLogin({ onSuccess, subtitle }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return;
    setSubmitting(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setSubmitting(false);
    if (res.ok) onSuccess();
    else setError(t("portalLogin.errInvalid"));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="card p-8 w-full max-w-sm space-y-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white">
            <Icon name="lock" size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="font-semibold text-slate-800">{t("portalLogin.title")}</div>
            {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div>
          <label className="label">{t("settings.fieldUsername")}</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">{t("settings.fieldPassword")}</label>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
          {t("portalLogin.submit")}
        </button>
      </form>
    </div>
  );
}
