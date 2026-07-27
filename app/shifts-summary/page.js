"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";

export default function ShiftSummaryPage() {
  const [summary, setSummary] = useState([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/summary?from=${from}&to=${to}`);
      if (res.ok) {
        setSummary(await res.json());
      } else {
        alert("Error loading shifts");
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = {
    sales: summary.reduce((s, x) => s + x.sales, 0),
    expenses: summary.reduce((s, x) => s + x.expenses, 0),
    profit: summary.reduce((s, x) => s + x.profit, 0),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Shift Summary</h1>

      <div className="card p-4 flex gap-4">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary mt-7" disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-sm text-slate-500">Total Sales</div>
          <div className="text-2xl font-bold text-brand-700">{money(totals.sales, "€")}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-slate-500">Total Expenses</div>
          <div className="text-2xl font-bold text-red-600">{money(totals.expenses, "€")}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-slate-500">Net Profit</div>
          <div className="text-2xl font-bold text-emerald-600">{money(totals.profit, "€")}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Cashier</th>
                <th className="table-th">Time</th>
                <th className="table-th text-right">Sales</th>
                <th className="table-th text-right">Expenses</th>
                <th className="table-th text-right">Profit</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.length === 0 ? (
                <tr>
                  <td className="table-td text-slate-400" colSpan={7}>
                    No shifts
                  </td>
                </tr>
              ) : (
                summary.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{s.date}</td>
                    <td className="table-td">{s.cashier}</td>
                    <td className="table-td text-sm">
                      {new Date(s.openedAt).toLocaleTimeString().slice(0, 5)}
                      {s.closedAt && ` → ${new Date(s.closedAt).toLocaleTimeString().slice(0, 5)}`}
                    </td>
                    <td className="table-td text-right font-semibold text-green-600">{money(s.sales, "€")}</td>
                    <td className="table-td text-right text-red-600">{money(s.expenses, "€")}</td>
                    <td className="table-td text-right font-bold text-emerald-600">{money(s.profit, "€")}</td>
                    <td className="table-td">
                      <span className={`badge ${s.status === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
