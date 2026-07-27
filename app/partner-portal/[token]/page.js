"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { formatDate, formatDateTime, money } from "@/lib/format";
import { itemQuoteTotal, jobQuoteTotal, getPriorities } from "@/lib/jobs";
import { getSeenCount, setSeenCount, ownerMsgCount, unreadCountForJobsFromOwner } from "@/lib/jobNotifications";
import { playNotifySound } from "@/lib/notifySound";
import Icon from "@/components/Icon";
import PortalLogin from "@/components/PortalLogin";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function PartnerPortalPage() {
  const { token } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [openJob, setOpenJob] = useState(null); // job id with messages expanded
  const [draft, setDraft] = useState({});
  const [pricingDraft, setPricingDraft] = useState({}); // jobId -> { itemId: { unitPrice, vatRate } }
  const [quoteSaving, setQuoteSaving] = useState(null);
  const [unread, setUnread] = useState(0);
  const prevUnreadRef = useRef(0);
  const firstLoadRef = useRef(true);

  const load = () => fetch(`/api/partner-portal/${token}`).then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))).then((d) => { setError(""); setErrorCode(""); setData(d); }).catch((e) => { setErrorCode(e.error || ""); setError(e.error ? t(e.error) : t("common.error")); });
  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Ειδοποίηση (badge + ήχος) όταν ο ιδιοκτήτης αλλάξει κάτι σε δουλειά μας.
  useEffect(() => {
    if (!data) return;
    const count = unreadCountForJobsFromOwner(data.jobs);
    setUnread(count);
    if (!firstLoadRef.current && count > prevUnreadRef.current) playNotifySound();
    prevUnreadRef.current = count;
    firstLoadRef.current = false;
  }, [data]);

  const setStage = async (jobId, stageId) => {
    await fetch(`/api/partner-portal/${token}/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId }) });
    load();
  };
  const complete = async (jobId) => {
    await fetch(`/api/partner-portal/${token}/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
    load();
  };
  const sendMessage = async (jobId) => {
    const text = (draft[jobId] || "").trim();
    if (!text) return;
    await fetch(`/api/partner-portal/${token}/jobs/${jobId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    setDraft((d) => ({ ...d, [jobId]: "" }));
    load();
  };
  const setItemPricing = (jobId, itemId, patch) => {
    setPricingDraft((d) => ({
      ...d,
      [jobId]: { ...(d[jobId] || {}), [itemId]: { ...(d[jobId]?.[itemId] || {}), ...patch } },
    }));
  };
  const priceFor = (job, item) => {
    const draft = pricingDraft[job.id]?.[item.id];
    return {
      unitPrice: draft?.unitPrice !== undefined ? draft.unitPrice : (item.partnerUnitPrice ?? ""),
      vatRate: draft?.vatRate !== undefined ? draft.vatRate : (item.partnerVatRate ?? 19),
    };
  };
  const submitPricing = async (job) => {
    const itemPricing = job.items.map((it) => {
      const p = priceFor(job, it);
      return { id: it.id, unitPrice: p.unitPrice, vatRate: p.vatRate };
    });
    setQuoteSaving(job.id);
    await fetch(`/api/partner-portal/${token}/jobs/${job.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemPricing }) });
    setQuoteSaving(null);
    setPricingDraft((d) => ({ ...d, [job.id]: {} }));
    load();
  };

  if (errorCode === "errors.loginRequired") {
    return <PortalLogin subtitle={t("portalLogin.subtitlePartner")} onSuccess={load} />;
  }
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 text-center max-w-md">
        <Icon name="lock" size={32} className="mx-auto mb-3 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">{t("partnerPortal.unavailableTitle")}</h1>
        <p className="text-slate-500">{error}</p>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-400">{t("common.loading")}</div>;

  const activeJobs = data.jobs.filter((j) => j.status !== "done");
  const doneJobs = data.jobs.filter((j) => j.status === "done");
  const stageName = (id) => data.stages.find((s) => s.id === id)?.name || "—";
  const PRIORITIES = getPriorities(t);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold leading-tight">{data.company.name}</div>
            <div className="text-xs text-brand-100">{t("partnerPortal.tagline", { partner: data.partner.name })}</div>
          </div>
          {unread > 0 && (
            <div className="relative shrink-0">
              <Icon name="bell" size={20} className="text-white" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-center font-bold">{unread}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-800">{t("partnerPortal.activeJobs")} ({activeJobs.length})</h1>
        {activeJobs.length === 0 ? (
          <p className="text-sm text-slate-400">{t("partnerPortal.noJobs")}</p>
        ) : activeJobs.map((j) => {
          const prio = PRIORITIES[j.priority] || PRIORITIES.normal;
          return (
          <div key={j.id} className={`card p-4 space-y-3 ${j.priority === "urgent" ? "border-l-4 border-red-500" : j.priority === "high" ? "border-l-4 border-amber-400" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] text-slate-400 font-mono">{j.number}</div>
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                  {j.title}
                  {(j.priority === "urgent" || j.priority === "high") && (
                    <span className={`badge ${prio.color} shrink-0`}><span className={`w-1.5 h-1.5 rounded-full ${prio.dot} inline-block mr-1`} />{prio.label}</span>
                  )}
                </div>
                {j.customerName && <div className="text-xs text-slate-500 mt-0.5">{t("partnerPortal.forCustomer")}: {j.customerName}</div>}
              </div>
              {j.dueDate && <span className="badge bg-slate-100 text-slate-600 shrink-0">{formatDate(j.dueDate)}</span>}
            </div>
            {(j.items || []).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">{t("partnerPortal.pricingTitle")}</div>
                <div className="space-y-1.5">
                  {j.items.map((it) => {
                    const p = priceFor(j, it);
                    const lineTotal = itemQuoteTotal({ ...it, partnerUnitPrice: p.unitPrice === "" ? null : Number(p.unitPrice), partnerVatRate: Number(p.vatRate) });
                    return (
                      <div key={it.id} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-2">
                        <div className="text-xs text-slate-600 flex-1 min-w-[100px]">{it.quantity} {it.unit} — {it.description}</div>
                        <input
                          type="number" min="0" step="any"
                          className="input !py-1 text-xs !w-20"
                          placeholder={t("partnerPortal.priceLabel")}
                          value={p.unitPrice}
                          onChange={(e) => setItemPricing(j.id, it.id, { unitPrice: e.target.value })}
                        />
                        <select
                          className="input !py-1 text-xs !w-20"
                          value={p.vatRate}
                          onChange={(e) => setItemPricing(j.id, it.id, { vatRate: e.target.value })}
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={9}>9%</option>
                          <option value={19}>19%</option>
                        </select>
                        <div className="text-xs font-semibold text-slate-700 w-20 text-right">{lineTotal != null ? money(lineTotal, data.company.currency) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => submitPricing(j)} disabled={quoteSaving === j.id} className="btn-primary !py-1 text-xs">{quoteSaving === j.id ? t("common.saving") : t("partnerPortal.submitQuote")}</button>
                  {jobQuoteTotal(j.items) != null && (
                    <div className="text-sm font-bold text-emerald-700">{t("partnerPortal.totalLabel")}: {money(jobQuoteTotal(j.items), data.company.currency)}</div>
                  )}
                </div>
              </div>
            )}
            {(j.designs || []).length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">{t("partnerPortal.designs")}</div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {j.designs.map((d) => (
                    d.type?.startsWith("image/") ? (
                      <a key={d.id} href={d.url || d.dataUrl} target="_blank" rel="noreferrer" className="block border border-slate-200 rounded-lg overflow-hidden">
                        <img src={d.url || d.dataUrl} alt={d.name} className="w-full h-16 object-cover" />
                      </a>
                    ) : (
                      <a key={d.id} href={d.url || d.dataUrl} target="_blank" rel="noreferrer" download={d.name} className="border border-slate-200 rounded-lg h-16 flex flex-col items-center justify-center bg-slate-50 gap-1">
                        <Icon name="note" size={16} className="text-slate-400" />
                        <span className="text-[8px] text-slate-500 px-1 truncate w-full text-center">{d.name}</span>
                      </a>
                    )
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !py-1 !w-auto text-sm" value={j.stageId} onChange={(e) => setStage(j.id, e.target.value)}>
                {data.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={() => complete(j.id)} className="btn-secondary !py-1 text-xs text-emerald-700"><Icon name="check" size={13} /> {t("partnerPortal.markDone")}</button>
              <button
                onClick={() => {
                  const opening = openJob !== j.id;
                  setOpenJob(opening ? j.id : null);
                  if (opening) setSeenCount(j.id, ownerMsgCount(j));
                }}
                className="btn-ghost !py-1 text-xs ml-auto relative"
              >
                <Icon name="note" size={13} /> {t("partnerPortal.messages")} ({(j.messages || []).length})
                {Math.max(0, ownerMsgCount(j) - getSeenCount(j.id)) > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            </div>
            {j.notes && <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">{j.notes}</div>}
            {openJob === j.id && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(j.messages || []).length === 0 ? (
                    <p className="text-xs text-slate-400">{t("partnerPortal.noMessages")}</p>
                  ) : j.messages.map((m) => (
                    m.system ? (
                      <div key={m.id} className="text-[11px] text-center text-slate-400 italic py-1">
                        {m.text} · {formatDateTime(m.createdAt)}
                      </div>
                    ) : (
                      <div key={m.id} className={`text-sm rounded-lg px-3 py-2 max-w-[80%] ${m.author === "partner" ? "bg-brand-50 ml-auto text-brand-800" : "bg-slate-100 text-slate-700"}`}>
                        <div className="text-[10px] opacity-60 mb-0.5">{m.author === "partner" ? data.partner.name : data.company.name} · {formatDateTime(m.createdAt)}</div>
                        {m.text}
                      </div>
                    )
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input !py-1.5 text-sm"
                    value={draft[j.id] || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [j.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage(j.id)}
                    placeholder={t("partnerPortal.messagePlaceholder")}
                  />
                  <button onClick={() => sendMessage(j.id)} className="btn-primary !py-1.5 text-sm">{t("partnerPortal.send")}</button>
                </div>
              </div>
            )}
          </div>
          );
        })}

        {doneJobs.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-slate-500 pt-4">{t("partnerPortal.completedJobs")} ({doneJobs.length})</h2>
            <div className="space-y-2">
              {doneJobs.map((j) => (
                <div key={j.id} className="card p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">{j.number}</div>
                    <div className="font-medium text-slate-600">{j.title}</div>
                  </div>
                  <span className="badge bg-emerald-100 text-emerald-700">{formatDate(j.completedAt)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
