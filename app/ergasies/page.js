"use client";

import { useEffect, useState } from "react";
import { formatDate, formatDateTime, todayISO, money } from "@/lib/format";
import { getPriorities, STAGE_COLORS, STAGE_COLOR_OPTIONS, itemQuoteTotal, jobQuoteTotal, commissionAmount, itemCommissionAmount } from "@/lib/jobs";
import { partnerMsgCount, setSeenCount } from "@/lib/jobNotifications";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function JobsPage() {
  const { t } = useLanguage();
  const MIN_COMMISSION_PERCENT = 20;
  const emptyJob = { title: "", customerId: "", partnerShopId: "", priority: "normal", dueDate: "", assignedTo: "", items: [], designs: [], notes: "", stageId: "", commissionPercent: MIN_COMMISSION_PERCENT };
  const PRIORITIES = getPriorities(t);

  const [stages, setStages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [doneJobs, setDoneJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [partnerShops, setPartnerShops] = useState([]);
  const [tab, setTab] = useState("board");
  const [jobForm, setJobForm] = useState(null);
  const [stagesModal, setStagesModal] = useState(null);
  const [partnersModal, setPartnersModal] = useState(false);
  const [msgDraft, setMsgDraft] = useState("");
  const [showPerItemCommission, setShowPerItemCommission] = useState(false);
  const [drag, setDrag] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const loadStages = () => fetch("/api/stages").then((r) => r.json()).then(setStages);
  const loadJobs = () => {
    fetch("/api/jobs?status=active").then((r) => r.json()).then(setJobs);
    fetch("/api/jobs?status=done").then((r) => r.json()).then(setDoneJobs);
  };
  const loadPartners = () => fetch("/api/partner-shops").then((r) => r.json()).then(setPartnerShops);
  useEffect(() => {
    loadStages(); loadJobs(); loadPartners();
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayISO();

  const saveJob = async () => {
    if (!jobForm.title.trim()) { alert(t("jobs.errNeedTitle")); return; }
    // Τελευταία δικλείδα ασφαλείας — και όχι μόνο το onBlur του πεδίου — για την περίπτωση που
    // πατήθηκε Save ενώ το πεδίο ήταν ακόμα εστιασμένο με τιμή κάτω από το ελάχιστο ποσοστό.
    const commissionPercent = jobForm.commissionPercent === "" ? MIN_COMMISSION_PERCENT : Math.max(MIN_COMMISSION_PERCENT, Number(jobForm.commissionPercent) || 0);
    const payload = { ...jobForm, commissionPercent };
    const method = jobForm.id ? "PUT" : "POST";
    const url = jobForm.id ? `/api/jobs/${jobForm.id}` : "/api/jobs";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setJobForm(null); loadJobs();
  };
  const delJob = async (id) => { if (!confirm(t("jobs.confirmDelete"))) return; await fetch(`/api/jobs/${id}`, { method: "DELETE" }); loadJobs(); };
  const [uploadingDesigns, setUploadingDesigns] = useState(false);
  const onDesignFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingDesigns(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (res.ok) {
        const uploaded = await res.json();
        setJobForm((f) => ({
          ...f,
          designs: [...(f.designs || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: uploaded.name, type: uploaded.type, url: uploaded.url }],
        }));
      } else {
        alert(t("common.error"));
      }
    }
    setUploadingDesigns(false);
  };
  const removeDesign = (id) => setJobForm((f) => ({ ...f, designs: f.designs.filter((d) => d.id !== id) }));
  const sendJobMessage = async () => {
    if (!msgDraft.trim() || !jobForm?.id) return;
    const res = await fetch(`/api/jobs/${jobForm.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msgDraft.trim() }) });
    if (res.ok) {
      const updated = await res.json();
      setJobForm((f) => ({ ...f, messages: updated.messages }));
      setSeenCount(updated.id, partnerMsgCount(updated));
      setMsgDraft("");
      loadJobs();
    }
  };
  const moveJob = async (id, stageId) => { await fetch(`/api/jobs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId }) }); loadJobs(); };
  const completeJob = async (id) => { await fetch(`/api/jobs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) }); loadJobs(); };
  const reopenJob = async (id) => { await fetch(`/api/jobs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) }); loadJobs(); };

  const onDrop = (stageId) => { if (drag) moveJob(drag, stageId); setDrag(null); setDragOver(null); };

  const stageIndex = (sid) => stages.findIndex((s) => s.id === sid);
  const moveByArrow = (job, dir) => {
    const i = stageIndex(job.stageId);
    const ni = i + dir;
    if (ni >= 0 && ni < stages.length) moveJob(job.id, stages[ni].id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("jobs.title")}</h1>
          <p className="text-slate-500 text-sm">{t("jobs.activeCount", { count: jobs.length })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPartnersModal(true)} className="btn-secondary"><Icon name="truck" size={15} /> {t("jobs.partnersButton")}</button>
          <button onClick={() => setStagesModal(stages.map((s) => ({ ...s })))} className="btn-secondary"><Icon name="settings" size={15} /> {t("jobs.stagesButton")}</button>
          <button onClick={() => setJobForm({ ...emptyJob, stageId: stages[0]?.id || "" })} className="btn-primary"><Icon name="plus" size={16} /> {t("jobs.newJob")}</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => setTab("board")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "board" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("jobs.tabBoard")}</button>
        <button onClick={() => setTab("history")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "history" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{t("jobs.tabHistory", { count: doneJobs.length })}</button>
      </div>

      {tab === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const col = jobs.filter((j) => j.stageId === stage.id);
            const sc = STAGE_COLORS[stage.color] || STAGE_COLORS.slate;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(stage.id)}
                className={`w-72 shrink-0 rounded-xl border ${dragOver === stage.id ? "border-brand-400 bg-brand-50/50" : "border-slate-200 bg-slate-50"} flex flex-col`}
              >
                <div className={`rounded-t-xl px-3 py-2 flex items-center justify-between ${sc.head}`}>
                  <span className="font-semibold text-sm">{stage.name}</span>
                  <span className="badge bg-white/70">{col.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px] flex-1">
                  {col.length === 0 && <div className="text-xs text-slate-400 text-center py-6">—</div>}
                  {col.map((job) => {
                    const pr = PRIORITIES[job.priority] || PRIORITIES.normal;
                    const overdue = job.dueDate && job.dueDate < today;
                    const i = stageIndex(stage.id);
                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={() => setDrag(job.id)}
                        onDragEnd={() => { setDrag(null); setDragOver(null); }}
                        className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] text-slate-400 font-mono">{job.number}</div>
                            <div className="font-semibold text-sm text-slate-800 leading-tight">{job.title}</div>
                          </div>
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${pr.dot}`} title={pr.label}></span>
                        </div>
                        {job.customerName && <div className="text-xs text-slate-500 mt-1 truncate flex items-center gap-1"><Icon name="users" size={12} /> {job.customerName}</div>}
                        {job.partnerShopName && <div className="text-xs text-brand-600 mt-0.5 truncate flex items-center gap-1"><Icon name="truck" size={12} /> {job.partnerShopName}{(job.messages || []).length > 0 && <span className="badge bg-brand-100 text-brand-700 !px-1.5">{job.messages.length}</span>}</div>}
                        {(job.items || []).length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {job.items.map((it, i) => (
                              <div key={i} className="text-xs text-slate-500 truncate">{it.quantity} {it.unit} — {it.description}</div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                          {job.assignedTo && <span className="badge bg-slate-100 text-slate-600">{job.assignedTo}</span>}
                          {job.dueDate && <span className={`badge inline-flex items-center gap-1 ${overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}><Icon name="calendar" size={11} /> {formatDate(job.dueDate)}</span>}
                          {job.linkedNumber && <span className="badge bg-indigo-100 text-indigo-700">{job.linkedNumber}</span>}
                          {(job.designs || []).length > 0 && <span className="badge bg-violet-100 text-violet-700 inline-flex items-center gap-1"><Icon name="image" size={11} /> {job.designs.length}</span>}
                          {jobQuoteTotal(job.items) != null && <span className="badge bg-emerald-100 text-emerald-700 inline-flex items-center gap-1"><Icon name="money" size={11} /> {money(jobQuoteTotal(job.items), "€")}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                          <div className="flex gap-1">
                            <button onClick={() => moveByArrow(job, -1)} disabled={i === 0} className="btn-ghost !px-1.5 !py-0.5 text-xs disabled:opacity-30" title={t("jobs.prevStage")}><Icon name="arrowLeft" size={13} /></button>
                            <button onClick={() => moveByArrow(job, 1)} disabled={i === stages.length - 1} className="btn-ghost !px-1.5 !py-0.5 text-xs disabled:opacity-30" title={t("jobs.nextStage")}><Icon name="arrowRight" size={13} /></button>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setJobForm({ ...emptyJob, ...job, customerId: job.customerId || "", items: job.items || [], designs: job.designs || [], commissionPercent: job.commissionPercent ?? job.markupPercent ?? MIN_COMMISSION_PERCENT }); setMsgDraft(""); setSeenCount(job.id, partnerMsgCount(job)); }} className="btn-ghost !px-1.5 !py-0.5 text-xs"><Icon name="edit" size={13} /></button>
                            <button onClick={() => completeJob(job.id)} className="btn-ghost !px-1.5 !py-0.5 text-xs text-emerald-600" title={t("jobs.complete")}><Icon name="check" size={13} /></button>
                            <button onClick={() => delJob(job.id)} className="btn-ghost !px-1.5 !py-0.5 text-xs text-red-500"><Icon name="trash" size={13} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><th className="table-th">{t("jobs.colCode")}</th><th className="table-th">{t("jobs.colJob")}</th><th className="table-th">{t("jobs.colCustomer")}</th><th className="table-th">{t("jobs.colCompleted")}</th><th className="table-th"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doneJobs.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={5}>{t("jobs.noHistory")}</td></tr> : doneJobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono text-xs">{j.number}</td>
                  <td className="table-td font-medium">{j.title}</td>
                  <td className="table-td">{j.customerName || "—"}</td>
                  <td className="table-td">{formatDate(j.completedAt)}</td>
                  <td className="table-td text-right whitespace-nowrap">
                    <button onClick={() => reopenJob(j.id)} className="btn-ghost !px-2 !py-1 text-xs"><Icon name="refresh" size={13} /> {t("jobs.restore")}</button>
                    <button onClick={() => delJob(j.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal εργασίας */}
      {jobForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{jobForm.id ? t("jobs.modalTitle", { number: jobForm.number || "" }) : t("jobs.modalNewTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="label">{t("jobs.fieldTitle")}</label><input className="input" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} placeholder={t("jobs.titlePlaceholder")} /></div>
              <div><label className="label">{t("jobs.fieldCustomer")}</label><select className="input" value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })}><option value="">—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldPartnerShop")}</label><select className="input" value={jobForm.partnerShopId || ""} onChange={(e) => setJobForm({ ...jobForm, partnerShopId: e.target.value })}><option value="">{t("jobs.noPartner")}</option>{partnerShops.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldStage")}</label><select className="input" value={jobForm.stageId} onChange={(e) => setJobForm({ ...jobForm, stageId: e.target.value })}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldPriority")}</label><select className="input" value={jobForm.priority} onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value })}>{Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldDue")}</label><input type="date" className="input" value={jobForm.dueDate} onChange={(e) => setJobForm({ ...jobForm, dueDate: e.target.value })} /></div>
              <div><label className="label">{t("jobs.fieldAssignee")}</label><input className="input" value={jobForm.assignedTo} onChange={(e) => setJobForm({ ...jobForm, assignedTo: e.target.value })} placeholder={t("jobs.assigneePlaceholder")} /></div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label !mb-0">{t("jobs.fieldItems")}</label>
                <button
                  type="button"
                  onClick={() => setJobForm({ ...jobForm, items: [...(jobForm.items || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, description: "", quantity: "", unit: t("common.unit") }] })}
                  className="btn-secondary !py-1 text-xs"
                >
                  <Icon name="plus" size={13} /> {t("jobs.addItem")}
                </button>
              </div>
              <div className="space-y-2">
                {(jobForm.items || []).map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <input
                      className="input flex-1"
                      placeholder={t("jobs.itemDescPlaceholder")}
                      value={it.description}
                      onChange={(e) => {
                        const items = [...jobForm.items];
                        items[idx] = { ...items[idx], description: e.target.value };
                        setJobForm({ ...jobForm, items });
                      }}
                    />
                    <input
                      className="input !w-20"
                      placeholder={t("jobs.fieldQty")}
                      value={it.quantity}
                      onChange={(e) => {
                        const items = [...jobForm.items];
                        items[idx] = { ...items[idx], quantity: e.target.value };
                        setJobForm({ ...jobForm, items });
                      }}
                    />
                    <input
                      className="input !w-24"
                      placeholder={t("jobs.fieldUnit")}
                      value={it.unit}
                      onChange={(e) => {
                        const items = [...jobForm.items];
                        items[idx] = { ...items[idx], unit: e.target.value };
                        setJobForm({ ...jobForm, items });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setJobForm({ ...jobForm, items: jobForm.items.filter((_, i) => i !== idx) })}
                      className="btn-ghost !px-2 !py-1 text-red-500"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
                {(!jobForm.items || jobForm.items.length === 0) && (
                  <p className="text-sm text-slate-400 italic">{t("jobs.noItems")}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label !mb-0">{t("jobs.fieldDesigns")}</label>
                <label className="btn-secondary !py-1 text-xs cursor-pointer">
                  <Icon name="upload" size={13} /> {uploadingDesigns ? t("common.saving") : t("jobs.uploadDesign")}
                  <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={onDesignFiles} disabled={uploadingDesigns} />
                </label>
              </div>
              {(jobForm.designs || []).length === 0 ? (
                <p className="text-sm text-slate-400 italic">{t("jobs.noDesigns")}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {jobForm.designs.map((d) => (
                    <div key={d.id} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                      {d.type?.startsWith("image/") ? (
                        <a href={d.url || d.dataUrl} target="_blank" rel="noreferrer"><img src={d.url || d.dataUrl} alt={d.name} className="w-full h-20 object-cover" /></a>
                      ) : (
                        <a href={d.url || d.dataUrl} target="_blank" rel="noreferrer" download={d.name} className="w-full h-20 flex flex-col items-center justify-center bg-slate-50 gap-1">
                          <Icon name="note" size={20} className="text-slate-400" />
                          <span className="text-[9px] text-slate-500 px-1 truncate w-full text-center">{d.name}</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => removeDesign(d.id)}
                        className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4"><label className="label">{t("jobs.fieldNotes")}</label><textarea className="input" rows={3} value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} /></div>

            {jobForm.id && jobForm.partnerShopId && (
              <div className="border-t border-slate-100 mt-4 pt-4">
                {jobQuoteTotal(jobForm.items) != null && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 mb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">{t("jobs.partnerQuoteLabel")}</div>
                      <label className="text-[11px] text-emerald-700 flex items-center gap-1 cursor-pointer normal-case font-normal">
                        <input type="checkbox" checked={showPerItemCommission} onChange={(e) => setShowPerItemCommission(e.target.checked)} />
                        {t("jobs.showPerItemCommission")}
                      </label>
                    </div>
                    {jobForm.items.filter((it) => it.partnerUnitPrice != null).map((it) => (
                      <div key={it.id} className="flex justify-between items-start text-sm text-emerald-800">
                        <span>
                          {it.quantity} {it.unit} — {it.description} <span className="text-emerald-600">({money(it.partnerUnitPrice, "€")} + {it.partnerVatRate}%)</span>
                          {showPerItemCommission && (
                            <div className="text-[11px] text-emerald-600">
                              {t("jobs.commissionAmountLabel")}: {money(itemCommissionAmount(it, jobForm.commissionPercent), "€")}
                            </div>
                          )}
                        </span>
                        <span className="font-medium shrink-0">{money(itemQuoteTotal(it), "€")}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-emerald-900 border-t border-emerald-200 pt-1">
                      <span>{t("jobs.partnerQuoteTotal")}</span>
                      <span>{money(jobQuoteTotal(jobForm.items), "€")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-emerald-200 pt-2 mt-1">
                      <label className="text-sm text-emerald-800 flex items-center gap-2">
                        {t("jobs.commissionPercentLabel")}
                        <input
                          type="number" step="any" min={MIN_COMMISSION_PERCENT}
                          className="input !py-1 !w-20 text-right"
                          value={jobForm.commissionPercent}
                          onChange={(e) => setJobForm({ ...jobForm, commissionPercent: e.target.value })}
                          onBlur={(e) => {
                            if (e.target.value !== "" && Number(e.target.value) < MIN_COMMISSION_PERCENT) {
                              setJobForm((f) => ({ ...f, commissionPercent: MIN_COMMISSION_PERCENT }));
                            }
                          }}
                          placeholder={String(MIN_COMMISSION_PERCENT)}
                        />
                        %
                      </label>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-900">
                      <span>{t("jobs.commissionAmountLabel")}</span>
                      <span>{money(commissionAmount(jobForm.items, jobForm.commissionPercent), "€")}</span>
                    </div>
                  </div>
                )}
                <label className="label mb-2">{t("jobs.messagesTitle")}</label>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 rounded-lg p-2">
                  {(jobForm.messages || []).length === 0 ? (
                    <p className="text-xs text-slate-400 p-2">{t("jobs.noMessages")}</p>
                  ) : jobForm.messages.map((m) => (
                    m.system ? (
                      <div key={m.id} className="text-[11px] text-center text-slate-400 italic py-1">
                        {m.text} · {formatDateTime(m.createdAt)}
                      </div>
                    ) : (
                      <div key={m.id} className={`text-sm rounded-lg px-3 py-2 max-w-[80%] ${m.author === "owner" ? "bg-brand-50 ml-auto text-brand-800" : "bg-white border border-slate-200 text-slate-700"}`}>
                        <div className="text-[10px] opacity-60 mb-0.5">{m.author === "owner" ? t("jobs.you") : (m.authorName || jobForm.partnerShopName)} · {formatDateTime(m.createdAt)}</div>
                        {m.text}
                      </div>
                    )
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="input !py-1.5 text-sm"
                    value={msgDraft}
                    onChange={(e) => setMsgDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendJobMessage()}
                    placeholder={t("jobs.messagePlaceholder")}
                  />
                  <button onClick={sendJobMessage} className="btn-secondary !py-1.5 text-sm">{t("jobs.send")}</button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setJobForm(null)} className="btn-secondary">{t("common.cancel")}</button><button onClick={saveJob} className="btn-primary">{t("common.save")}</button></div>
          </div>
        </div>
      )}

      {/* Modal σταδίων */}
      {stagesModal && (
        <StagesEditor initial={stagesModal} onClose={() => setStagesModal(null)} onSaved={() => { setStagesModal(null); loadStages(); loadJobs(); }} t={t} />
      )}

      {/* Modal συνεργατών τυπογραφείων */}
      {partnersModal && (
        <PartnersEditor partnerShops={partnerShops} onClose={() => setPartnersModal(false)} onChanged={loadPartners} t={t} />
      )}
    </div>
  );
}

const emptyPartnerForm = { name: "", contact: "", phone: "", email: "" };

function PartnersEditor({ partnerShops, onClose, onChanged, t }) {
  const [form, setForm] = useState(emptyPartnerForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [linkOpenId, setLinkOpenId] = useState(null);

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name, contact: p.contact || "", phone: p.phone || "", email: p.email || "" });
  };
  const cancelEdit = () => { setEditingId(null); setForm(emptyPartnerForm); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editingId) {
      await fetch(`/api/partner-shops/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/partner-shops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setForm(emptyPartnerForm);
    setEditingId(null);
    setSaving(false);
    onChanged();
  };
  const remove = async (id) => {
    if (!confirm(t("jobs.confirmRemovePartner"))) return;
    if (editingId === id) cancelEdit();
    await fetch(`/api/partner-shops/${id}`, { method: "DELETE" });
    onChanged();
  };
  const linkFor = (p) => `${window.location.origin}/partner-portal/${p.portalToken}`;
  const copyLink = async (p) => {
    const url = linkFor(p);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard API needs HTTPS — fall back to just showing the link to copy by hand.
      setLinkOpenId((id) => (id === p.id ? null : p.id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">{t("jobs.partnersEditorTitle")}</h2>
        <p className="text-sm text-slate-500 mb-4">{t("jobs.partnersEditorDesc")}</p>

        <div className="space-y-2 mb-4">
          {partnerShops.length === 0 ? (
            <p className="text-sm text-slate-400">{t("jobs.noPartners")}</p>
          ) : partnerShops.map((p) => (
            <div key={p.id} className={`rounded-lg p-2.5 ${editingId === p.id ? "bg-brand-50 border border-brand-200" : "bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-slate-400 truncate">{[p.contact, p.phone, p.email].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => copyLink(p)} className="btn-ghost !px-2 !py-1 text-xs">{copiedId === p.id ? t("jobs.copied") : <><Icon name="link" size={13} /> {t("jobs.copyLink")}</>}</button>
                  <button onClick={() => startEdit(p)} className="btn-ghost !px-2 !py-1 text-xs"><Icon name="edit" size={13} /></button>
                  <button onClick={() => remove(p.id)} className="btn-ghost !px-2 !py-1 text-red-500"><Icon name="trash" size={13} /></button>
                </div>
              </div>
              {linkOpenId === p.id && (
                <input
                  readOnly
                  className="input !py-1 text-xs mt-2"
                  value={linkFor(p)}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.target.select()}
                />
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-2">
          {editingId && <div className="text-xs font-medium text-brand-700">{t("jobs.editingPartner")}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder={t("jobs.partnerNamePlaceholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder={t("jobs.partnerContactPlaceholder")} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            <input className="input" placeholder={t("jobs.partnerPhonePlaceholder")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder={t("jobs.partnerEmailPlaceholder")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-secondary flex-1">
              {editingId ? <><Icon name="check" size={15} /> {t("common.save")}</> : <><Icon name="plus" size={15} /> {t("jobs.addPartner")}</>}
            </button>
            {editingId && <button onClick={cancelEdit} className="btn-ghost">{t("common.cancel")}</button>}
          </div>
        </div>

        <div className="flex justify-end mt-5"><button onClick={onClose} className="btn-secondary">{t("common.close")}</button></div>
      </div>
    </div>
  );
}

function StagesEditor({ initial, onClose, onSaved, t }) {
  const [list, setList] = useState(initial);
  const upd = (i, patch) => setList((l) => l.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const add = () => setList((l) => [...l, { id: "", name: t("jobs.stagesEditorTitle"), color: "slate" }]);
  const remove = (i) => setList((l) => l.filter((_, idx) => idx !== i));
  const move = (i, dir) => setList((l) => { const ni = i + dir; if (ni < 0 || ni >= l.length) return l; const c = [...l]; [c[i], c[ni]] = [c[ni], c[i]]; return c; });
  const save = async () => {
    if (list.some((s) => !s.name.trim())) { alert(t("jobs.errNeedAllNames")); return; }
    await fetch("/api/stages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stages: list }) });
    onSaved();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">{t("jobs.stagesEditorTitle")}</h2>
        <p className="text-sm text-slate-500 mb-4">{t("jobs.stagesEditorDesc")}</p>
        <div className="space-y-2">
          {list.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col text-slate-400">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-20 hover:text-slate-600"><Icon name="chevronDown" size={14} className="rotate-180" /></button>
                <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="disabled:opacity-20 hover:text-slate-600"><Icon name="chevronDown" size={14} /></button>
              </div>
              <input className="input" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <select className="input !w-28" value={s.color} onChange={(e) => upd(i, { color: e.target.value })}>{STAGE_COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <button onClick={() => remove(i)} disabled={list.length <= 1} className="btn-ghost !px-2 text-red-500 disabled:opacity-30"><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
        <button onClick={add} className="btn-secondary mt-3"><Icon name="plus" size={15} /> {t("jobs.addStage")}</button>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="btn-secondary">{t("common.cancel")}</button><button onClick={save} className="btn-primary">{t("common.save")}</button></div>
      </div>
    </div>
  );
}
