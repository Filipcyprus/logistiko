"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import ReviewDialog from "@/components/ReviewDialog";
import { formatDate } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { findUnknownPlaceholders, hasAnyDiscount } from "@/lib/announce";

const MAX_RECIPIENTS = 40;

function AnnouncementsInner() {
  const { t } = useLanguage();
  const params = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tpl, setTpl] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [showInPortal, setShowInPortal] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [profession, setProfession] = useState("");

  const [preview, setPreview] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState("");
  const [checks, setChecks] = useState(null);
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");

  const loadHistory = () => fetch("/api/announcements").then((r) => r.json()).then(setHistory);

  const applyTemplate = (key) => {
    setTpl(key);
    if (!key) return;
    setSubject(t(`announce.tpl_${key}_subject`));
    setBody(t(`announce.tpl_${key}_body`));
    setPreview(null);
  };

  useEffect(() => {
    Promise.all([fetch("/api/customers").then((r) => r.json()), fetch("/api/settings").then((r) => r.json())]).then(([c, s]) => {
      setCustomers(c);
      setSettings(s);
      setTestTo(s.mail?.fromEmail || s.email || "");
      const only = params.get("customer");
      if (only && c.some((x) => x.id === only)) setSelected(new Set([only]));
    });
    loadHistory();
    const tplParam = params.get("template");
    if (tplParam && ["discount", "products", "info"].includes(tplParam)) applyTemplate(tplParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const professions = useMemo(() => [...new Set(customers.map((c) => c.profession).filter(Boolean))].sort(), [customers]);
  const visible = customers.filter((c) => !profession || c.profession === profession);
  const chosen = customers.filter((c) => selected.has(c.id));
  const hasLink = (c) => !!(c.b2bEnabled && c.b2bToken);

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectVisible = () => setSelected((prev) => { const n = new Set(prev); visible.forEach((c) => n.add(c.id)); return n; });
  const clearAll = () => setSelected(new Set());

  const payload = (extra = {}) => ({
    subject, body, customerIds: chosen.map((c) => c.id), sendEmail, showInPortal, includeLink,
    kind: tpl || "info", ...extra,
  });

  const errText = async (res) => { const e = await res.json().catch(() => ({})); return e.error ? t(e.error) : t("common.error"); };

  const doPreview = async () => {
    setNote("");
    const firstId = chosen[0]?.id || visible[0]?.id || customers[0]?.id;
    if (!firstId) return;
    setBusy("preview");
    const res = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload({ customerIds: [firstId], preview: true })) });
    setBusy("");
    if (!res.ok) { setNote(await errText(res)); return; }
    setPreview(await res.json());
  };

  const doTest = async () => {
    setNote("");
    if (!testTo.trim()) { setNote(t("announce.errBadTestAddress")); return; }
    const firstId = chosen[0]?.id || customers[0]?.id;
    setBusy("test");
    const res = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload({ customerIds: [firstId], testTo: testTo.trim() })) });
    setBusy("");
    setNote(res.ok ? t("announce.testSent", { to: testTo.trim() }) : await errText(res));
  };

  // Ό,τι μπορεί να πάει στραβά, φαίνεται ΠΡΙΝ σταλεί — μετά δεν ανακαλείται ένα email.
  const buildChecks = () => {
    const out = [];
    if (!subject.trim()) out.push({ level: "error", text: t("announce.errNeedSubject") });
    if (!body.trim()) out.push({ level: "error", text: t("announce.errNeedBody") });
    if (!sendEmail && !showInPortal) out.push({ level: "error", text: t("announce.errNoChannel") });
    if (chosen.length === 0) out.push({ level: "error", text: t("announce.errNoRecipients") });
    if (chosen.length > MAX_RECIPIENTS) out.push({ level: "error", text: t("announce.errTooMany") });
    if (sendEmail && !settings?.mail?.host) out.push({ level: "error", text: t("errors.emailNotConfigured") });
    if (out.some((c) => c.level === "error")) return out;

    const names = (list) => list.slice(0, 4).map((c) => c.name).join(", ") + (list.length > 4 ? ` +${list.length - 4}` : "");
    if (sendEmail) {
      const optedOut = chosen.filter((c) => c.emailOptOut);
      const noEmail = chosen.filter((c) => !c.emailOptOut && !String(c.email || "").trim());
      if (optedOut.length) out.push({ level: "warn", text: t("announce.warnOptedOut", { count: optedOut.length, names: names(optedOut) }) });
      if (noEmail.length) out.push({ level: "warn", text: t("announce.warnNoEmail", { count: noEmail.length, names: names(noEmail) }) });
    }
    if ((sendEmail && includeLink) || showInPortal) {
      const noLink = chosen.filter((c) => !hasLink(c));
      if (noLink.length && includeLink) out.push({ level: "warn", text: t("announce.warnNoLink", { count: noLink.length, names: names(noLink) }) });
      if (noLink.length && showInPortal) out.push({ level: "warn", text: t("announce.warnNoPortalNotice", { count: noLink.length, names: names(noLink) }) });
    }
    const unknown = findUnknownPlaceholders(subject + " " + body);
    if (unknown.length) out.push({ level: "warn", text: t("announce.warnUnknownPlaceholder", { list: unknown.join(" ") }) });
    if (/\{discounts\}/i.test(body)) {
      const none = chosen.filter((c) => !hasAnyDiscount(c));
      if (none.length) out.push({ level: "warn", text: t("announce.warnNoDiscounts", { count: none.length, names: names(none) }) });
    }

    const emailCount = sendEmail ? chosen.filter((c) => !c.emailOptOut && String(c.email || "").trim()).length : 0;
    if (sendEmail) out.push({ level: "info", text: t("announce.infoEmails", { count: emailCount, from: settings?.mail?.fromEmail || settings?.mail?.user || "" }) });
    if (showInPortal) out.push({ level: "info", text: t("announce.infoPortal", { count: chosen.filter(hasLink).length }) });
    out.push({ level: "info", text: t("announce.infoIrreversible") });
    return out;
  };

  const doSend = async () => {
    setBusy("send");
    const res = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    setBusy("");
    setChecks(null);
    if (!res.ok) { setNote(await errText(res)); return; }
    setResult(await res.json());
    setNote("");
    loadHistory();
  };

  const statusBadge = (s) => ({
    sent: ["bg-emerald-100 text-emerald-700", t("announce.stSent")],
    failed: ["bg-red-100 text-red-700", t("announce.stFailed")],
    noEmail: ["bg-slate-100 text-slate-600", t("announce.stNoEmail")],
    optedOut: ["bg-slate-100 text-slate-600", t("announce.stOptedOut")],
    portalOnly: ["bg-sky-100 text-sky-700", t("announce.stPortalOnly")],
  }[s] || ["bg-slate-100 text-slate-600", s]);

  if (!settings) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("announce.title")}</h1>
        <p className="text-slate-500 text-sm max-w-3xl">{t("announce.subtitle")}</p>
      </div>

      {!settings.mail?.host && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
          <span>{t("announce.noSmtp")}</span>
          <Link href="/rythmiseis" className="btn-secondary !py-1.5">{t("nav.settings")}</Link>
        </div>
      )}

      {result && (
        <div className="card p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-800">{t("announce.resultTitle")}</div>
              <div className="text-sm text-slate-600 mt-1">{t("announce.resultLine", { sent: result.sent, failed: result.failed, skipped: result.skipped })}</div>
              {result.failed > 0 && <div className="text-sm text-red-600 mt-1">{t("announce.resultFailedHint")}</div>}
            </div>
            <button onClick={() => setResult(null)} className="btn-ghost !px-2 !py-1"><Icon name="x" size={14} /></button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ---- message ---- */}
        <div className="xl:col-span-3 space-y-4">
          <div className="card p-5 space-y-4">
            <div>
              <label className="label">{t("announce.template")}</label>
              <select className="input max-w-xs" value={tpl} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">{t("announce.tplNone")}</option>
                <option value="discount">{t("announce.tplDiscount")}</option>
                <option value="products">{t("announce.tplProducts")}</option>
                <option value="info">{t("announce.tplInfo")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("announce.subject")}</label>
              <input className="input" value={subject} maxLength={200} onChange={(e) => { setSubject(e.target.value); setPreview(null); }} />
            </div>
            <div>
              <label className="label">{t("announce.message")}</label>
              <textarea className="input font-normal" rows={10} value={body} maxLength={5000} onChange={(e) => { setBody(e.target.value); setPreview(null); }} />
              <p className="text-xs text-slate-400 mt-1.5">{t("announce.placeholdersHint")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm">
                <input type="checkbox" className="mt-0.5" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                <span><span className="font-medium text-slate-700">{t("announce.chEmail")}</span><span className="block text-xs text-slate-400">{t("announce.chEmailHint")}</span></span>
              </label>
              <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm">
                <input type="checkbox" className="mt-0.5" checked={showInPortal} onChange={(e) => setShowInPortal(e.target.checked)} />
                <span><span className="font-medium text-slate-700">{t("announce.chPortal")}</span><span className="block text-xs text-slate-400">{t("announce.chPortalHint")}</span></span>
              </label>
              <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm">
                <input type="checkbox" className="mt-0.5" checked={includeLink} onChange={(e) => { setIncludeLink(e.target.checked); setPreview(null); }} />
                <span><span className="font-medium text-slate-700">{t("announce.chLink")}</span><span className="block text-xs text-slate-400">{t("announce.chLinkHint")}</span></span>
              </label>
            </div>

            {note && <div className="text-sm rounded-lg px-3 py-2 bg-brand-50 text-brand-700">{note}</div>}

            <div className="flex flex-wrap items-end gap-2 pt-1">
              <button onClick={doPreview} disabled={busy === "preview" || !subject.trim() || !body.trim()} className="btn-secondary"><Icon name="eye" size={15} /> {busy === "preview" ? t("common.loading") : t("announce.preview")}</button>
              <div className="flex items-end gap-2 ml-auto flex-wrap">
                <div>
                  <label className="label">{t("announce.testTo")}</label>
                  <input type="email" className="input !w-56" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                </div>
                <button onClick={doTest} disabled={busy === "test" || !subject.trim() || !body.trim() || !settings.mail?.host} className="btn-secondary">{busy === "test" ? t("email.sending") : t("announce.sendTest")}</button>
              </div>
            </div>
          </div>

          {preview && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 flex items-center justify-between gap-3 flex-wrap">
                <span><b>{t("announce.previewFor", { name: preview.forCustomer })}</b> — {preview.subject}</span>
                <button onClick={() => setPreview(null)} className="btn-ghost !px-2 !py-1"><Icon name="x" size={14} /></button>
              </div>
              <iframe title="preview" sandbox="" srcDoc={preview.html} className="w-full h-[460px] bg-white" />
            </div>
          )}
        </div>

        {/* ---- recipients ---- */}
        <div className="xl:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="font-semibold text-slate-700">{t("announce.recipients")} <span className="text-slate-400 font-normal">({chosen.length})</span></div>
              <div className="flex items-center gap-2">
                {professions.length > 0 && (
                  <select className="input !py-1 !w-auto text-sm" value={profession} onChange={(e) => setProfession(e.target.value)}>
                    <option value="">{t("announce.allProfessions")}</option>
                    {professions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                <button onClick={selectVisible} className="btn-ghost text-sm">{t("announce.selectAll")}</button>
                <button onClick={clearAll} className="btn-ghost text-sm">{t("announce.clear")}</button>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
              {visible.length === 0 ? <div className="p-4 text-sm text-slate-400">{t("announce.noCustomers")}</div> : visible.map((c) => (
                <label key={c.id} className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 ${c.emailOptOut ? "opacity-60" : ""}`}>
                  <input type="checkbox" className="mt-1" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800 truncate">{c.name}{c.profession && <span className="text-xs text-slate-400 font-normal"> · {c.profession}</span>}</span>
                    <span className="block text-xs text-slate-500 truncate">{c.email || <span className="text-amber-600">{t("announce.stNoEmail")}</span>}</span>
                    <span className="flex flex-wrap gap-1 mt-1">
                      {hasLink(c) ? <span className="badge bg-sky-100 text-sky-700 text-[11px]">{t("announce.badgeLink")}</span> : <span className="badge bg-slate-100 text-slate-500 text-[11px]">{t("announce.badgeNoLink")}</span>}
                      {hasAnyDiscount(c) && <span className="badge bg-emerald-100 text-emerald-700 text-[11px]">{t("announce.badgeDiscount")}</span>}
                      {c.emailOptOut && <span className="badge bg-red-100 text-red-700 text-[11px]">{t("announce.stOptedOut")}</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setChecks(buildChecks())} disabled={busy === "send"} className="btn-primary w-full justify-center"><Icon name="bell" size={16} /> {t("announce.send", { count: chosen.length })}</button>
              <p className="text-xs text-slate-400 mt-2">{t("announce.sendHint", { max: MAX_RECIPIENTS })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- history ---- */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-700">{t("announce.history")}</div>
        {history.length === 0 ? <div className="p-4 text-sm text-slate-400">{t("announce.noHistory")}</div> : (
          <div className="divide-y divide-slate-100">
            {history.map((a) => (
              <details key={a.id} className="group">
                <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 flex items-center justify-between gap-3 flex-wrap list-none">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{a.subject}</span>
                    <span className="block text-xs text-slate-400">{formatDate(String(a.createdAt).slice(0, 10))} · {String(a.createdAt).slice(11, 16)} · {t("announce.toCount", { count: a.audience })}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    {a.channels?.email && <span className="badge bg-slate-100 text-slate-600">{t("announce.chEmail")}</span>}
                    {a.channels?.portal && <span className="badge bg-sky-100 text-sky-700">{t("announce.chPortal")}</span>}
                    {a.sent > 0 && <span className="badge bg-emerald-100 text-emerald-700">{t("announce.stSent")} {a.sent}</span>}
                    {a.failed > 0 && <span className="badge bg-red-100 text-red-700">{t("announce.stFailed")} {a.failed}</span>}
                    {a.skipped > 0 && <span className="badge bg-slate-100 text-slate-600">{t("announce.stSkipped")} {a.skipped}</span>}
                  </span>
                </summary>
                <div className="px-4 pb-3 space-y-1">
                  {(a.results || []).map((r, i) => {
                    const [cls, label] = statusBadge(r.status);
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{r.name}{r.email && <span className="text-slate-400"> · {r.email}</span>}</span>
                        <span className="flex items-center gap-2 shrink-0"><span className={`badge ${cls}`}>{label}</span>{r.error && <span className="text-xs text-red-500 max-w-[220px] truncate" title={r.error}>{r.error}</span>}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <ReviewDialog
        open={!!checks}
        title={t("announce.reviewTitle")}
        subtitle={t("announce.reviewSub")}
        checks={checks || []}
        busy={busy === "send"}
        confirmLabel={t("announce.confirmSend")}
        onCancel={() => setChecks(null)}
        onConfirm={doSend}
      />
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={null}>
      <AnnouncementsInner />
    </Suspense>
  );
}
