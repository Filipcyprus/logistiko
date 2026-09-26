"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { slotsSummary } from "@/lib/delivery";

const TZ = "Europe/Nicosia";

// Σελίδα "Ανοίγουμε σύντομα" για τον σύνδεσμο B2B — με αντίστροφη μέτρηση. Μόλις έρθει η ώρα, ξαναφορτώνει
// το portal και το κατάστημα ανοίγει μόνο του.
export default function PortalOpeningNotice({ opening, company, delivery, t, lang, onOpen }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, opening.opensAtMs - now);
  useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; onOpen && onOpen(); }
  }, [left, onOpen]);

  const locale = lang === "el" ? "el-GR" : "en-GB";
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(opening.opensAtMs));
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(opening.opensAtMs));

  const custom = lang === "el" ? (opening.messageEl || opening.messageEn) : (opening.messageEn || opening.messageEl);
  const message = custom || t("portal.openingMessage", { date, time });

  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const box = (value, label) => (
    <div className="flex-1 min-w-[64px] rounded-xl bg-slate-50 border border-slate-200 py-3">
      <div className="text-2xl sm:text-3xl font-bold text-slate-800 tabular-nums">{String(value).padStart(2, "0")}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-0.5">{label}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {company?.logo && <img src={company.logo} alt="" className="h-9 w-9 rounded object-contain bg-white p-0.5" />}
            <div className="font-bold truncate">{company?.name}</div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="card w-full max-w-xl p-6 sm:p-10 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1">
            <Icon name="clock" size={13} /> {t("portal.openingBadge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">{t("portal.openingTitle")}</h1>
          <p className="text-slate-600 leading-relaxed">{message}</p>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("portal.openingOpensOn")}</div>
            <div className="text-lg font-semibold text-slate-800 capitalize">{date}</div>
            <div className="text-3xl font-bold text-brand-700">{time}</div>
          </div>

          <div className="flex gap-2 sm:gap-3 justify-center">
            {box(days, t("portal.openingDays"))}
            {box(hours, t("portal.openingHours"))}
            {box(minutes, t("portal.openingMinutes"))}
            {box(seconds, t("portal.openingSeconds"))}
          </div>

          {delivery && delivery.enabled !== false && (delivery.slots || []).length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm text-left sm:text-center">
              <div className="font-semibold">🚚 {t("portal.freeDeliveryTitle")}</div>
              <div className="text-emerald-700">{slotsSummary(delivery.slots, lang === "el" ? "el-GR" : "en-GB")}</div>
            </div>
          )}

          <p className="text-sm text-slate-500">{t("portal.openingThanks")}</p>
          {(company?.phone || company?.email) && (
            <p className="text-xs text-slate-400">{t("portal.openingContact")} {[company.phone, company.email].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </main>
    </div>
  );
}
