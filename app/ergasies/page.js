"use client";

import { useEffect, useState } from "react";
import { formatDate, todayISO } from "@/lib/format";
import { getPriorities, STAGE_COLORS, STAGE_COLOR_OPTIONS } from "@/lib/jobs";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function JobsPage() {
  const { t } = useLanguage();
  const emptyJob = { title: "", customerId: "", priority: "normal", dueDate: "", assignedTo: "", quantity: "", unit: t("common.unit"), notes: "", stageId: "" };
  const PRIORITIES = getPriorities(t);

  const [stages, setStages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [doneJobs, setDoneJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tab, setTab] = useState("board");
  const [jobForm, setJobForm] = useState(null);
  const [stagesModal, setStagesModal] = useState(null);
  const [drag, setDrag] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const loadStages = () => fetch("/api/stages").then((r) => r.json()).then(setStages);
  const loadJobs = () => {
    fetch("/api/jobs?status=active").then((r) => r.json()).then(setJobs);
    fetch("/api/jobs?status=done").then((r) => r.json()).then(setDoneJobs);
  };
  useEffect(() => {
    loadStages(); loadJobs();
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayISO();

  const saveJob = async () => {
    if (!jobForm.title.trim()) { alert(t("jobs.errNeedTitle")); return; }
    const method = jobForm.id ? "PUT" : "POST";
    const url = jobForm.id ? `/api/jobs/${jobForm.id}` : "/api/jobs";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(jobForm) });
    setJobForm(null); loadJobs();
  };
  const delJob = async (id) => { if (!confirm(t("jobs.confirmDelete"))) return; await fetch(`/api/jobs/${id}`, { method: "DELETE" }); loadJobs(); };
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
                        <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                          {job.quantity && <span className="text-slate-500">{job.quantity} {job.unit}</span>}
                          {job.assignedTo && <span className="badge bg-slate-100 text-slate-600">{job.assignedTo}</span>}
                          {job.dueDate && <span className={`badge inline-flex items-center gap-1 ${overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}><Icon name="calendar" size={11} /> {formatDate(job.dueDate)}</span>}
                          {job.linkedNumber && <span className="badge bg-indigo-100 text-indigo-700">{job.linkedNumber}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                          <div className="flex gap-1">
                            <button onClick={() => moveByArrow(job, -1)} disabled={i === 0} className="btn-ghost !px-1.5 !py-0.5 text-xs disabled:opacity-30" title={t("jobs.prevStage")}><Icon name="arrowLeft" size={13} /></button>
                            <button onClick={() => moveByArrow(job, 1)} disabled={i === stages.length - 1} className="btn-ghost !px-1.5 !py-0.5 text-xs disabled:opacity-30" title={t("jobs.nextStage")}><Icon name="arrowRight" size={13} /></button>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setJobForm({ ...emptyJob, ...job, customerId: job.customerId || "" })} className="btn-ghost !px-1.5 !py-0.5 text-xs"><Icon name="edit" size={13} /></button>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setJobForm(null)}>
          <div className="card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{jobForm.id ? t("jobs.modalTitle", { number: jobForm.number || "" }) : t("jobs.modalNewTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="label">{t("jobs.fieldTitle")}</label><input className="input" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} placeholder={t("jobs.titlePlaceholder")} /></div>
              <div><label className="label">{t("jobs.fieldCustomer")}</label><select className="input" value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })}><option value="">—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldStage")}</label><select className="input" value={jobForm.stageId} onChange={(e) => setJobForm({ ...jobForm, stageId: e.target.value })}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldPriority")}</label><select className="input" value={jobForm.priority} onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value })}>{Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className="label">{t("jobs.fieldDue")}</label><input type="date" className="input" value={jobForm.dueDate} onChange={(e) => setJobForm({ ...jobForm, dueDate: e.target.value })} /></div>
              <div><label className="label">{t("jobs.fieldAssignee")}</label><input className="input" value={jobForm.assignedTo} onChange={(e) => setJobForm({ ...jobForm, assignedTo: e.target.value })} placeholder={t("jobs.assigneePlaceholder")} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">{t("jobs.fieldQty")}</label><input className="input" value={jobForm.quantity} onChange={(e) => setJobForm({ ...jobForm, quantity: e.target.value })} /></div>
                <div><label className="label">{t("jobs.fieldUnit")}</label><input className="input" value={jobForm.unit} onChange={(e) => setJobForm({ ...jobForm, unit: e.target.value })} /></div>
              </div>
              <div className="sm:col-span-2"><label className="label">{t("jobs.fieldNotes")}</label><textarea className="input" rows={3} value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setJobForm(null)} className="btn-secondary">{t("common.cancel")}</button><button onClick={saveJob} className="btn-primary">{t("common.save")}</button></div>
          </div>
        </div>
      )}

      {/* Modal σταδίων */}
      {stagesModal && (
        <StagesEditor initial={stagesModal} onClose={() => setStagesModal(null)} onSaved={() => { setStagesModal(null); loadStages(); loadJobs(); }} t={t} />
      )}
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
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
