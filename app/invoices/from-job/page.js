"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function InvoiceFromJobPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [form, setForm] = useState({ items: [{ description: "", qty: 1, unitPrice: 0 }] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/jobs").then(r => r.json()).then(setJobs).catch(e => setErr(e.message));
  }, []);

  const selectJob = (job) => {
    setSelectedJob(job);
    setForm({
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      paymentMethod: "card",
      items: [{ description: "", qty: 1, unitPrice: 0 }],
    });
    setErr("");
  };

  const updateItem = (idx, patch) => {
    setForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it),
    }));
  };

  const removeItem = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { description: "", qty: 1, unitPrice: 0 }] }));
  };

  const submit = async () => {
    const items = form.items.filter(it => it.description?.trim() && it.qty > 0);
    if (!form.customerName?.trim()) { setErr(t("invoices.errCustomer")); return; }
    if (items.length === 0) { setErr("Add at least one item"); return; }

    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: form.customerName,
        customerPhone: form.customerPhone || "",
        status: "unpaid",
        paymentMethod: form.paymentMethod,
        items: items.map(it => ({
          description: it.description,
          quantity: Number(it.qty),
          unitPrice: Number(it.unitPrice),
        })),
      }),
    });
    setSaving(false);

    if (res.ok) {
      const inv = await res.json();
      router.push(`/parastatika/${inv.id}`);
    } else {
      const e = await res.json().catch(() => ({}));
      setErr(e.error ? t(e.error) : t("common.error"));
    }
  };

  if (selectedJob) {
    const total = form.items.reduce((a, it) => a + (Number(it.qty || 0) * Number(it.unitPrice || 0)), 0);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedJob(null)} className="btn-secondary"><Icon name="arrowLeft" size={15} /> Back</button>
          <h1 className="text-2xl font-bold">Create Receipt from {selectedJob.number}</h1>
        </div>

        {err && <div className="text-sm bg-red-50 text-red-700 rounded-lg px-3 py-2">{err}</div>}

        <div className="card p-6 space-y-4">
          <div>
            <label className="label">Customer Name</label>
            <input className="input" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} />
          </div>

          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.customerPhone || ""} onChange={e => setForm({...form, customerPhone: e.target.value})} />
          </div>

          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-bold text-lg">Items</h2>
          {form.items.map((item, idx) => (
            <div key={idx} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">Description</label>
                <input className="input" value={item.description} onChange={e => updateItem(idx, {description: e.target.value})} placeholder="Item name" />
              </div>
              <div className="w-20">
                <label className="label">Qty</label>
                <input type="number" min="1" className="input" value={item.qty} onChange={e => updateItem(idx, {qty: e.target.value})} />
              </div>
              <div className="w-28">
                <label className="label">Price</label>
                <input type="number" step="0.01" min="0" className="input" value={item.unitPrice} onChange={e => updateItem(idx, {unitPrice: e.target.value})} />
              </div>
              <button onClick={() => removeItem(idx)} className="btn-ghost !px-2 text-red-500" disabled={form.items.length === 1}><Icon name="trash" size={14} /></button>
            </div>
          ))}
          <button onClick={addItem} className="btn-secondary"><Icon name="plus" size={15} /> Add Item</button>
        </div>

        <div className="card p-6 bg-slate-50">
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>€{money(total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setSelectedJob(null)} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Create Receipt"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Receipt from Job</h1>
        <Link href="/parastatika" className="btn-secondary"><Icon name="arrowLeft" size={15} /> Back to Invoices</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">Job</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Phone</th>
                <th className="table-th">Partner</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={5}>No jobs found</td></tr>
              ) : jobs.map(job => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="table-td font-medium">{job.number} · {job.title}</td>
                  <td className="table-td">{job.customerName}</td>
                  <td className="table-td text-sm">{job.customerPhone}</td>
                  <td className="table-td text-sm">{job.partnerShopName || "—"}</td>
                  <td className="table-td text-right">
                    <button onClick={() => selectJob(job)} className="btn-primary text-sm"><Icon name="plus" size={14} /> Create</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
