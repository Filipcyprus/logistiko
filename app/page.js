"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function Stat({ label, value, sub, color = "brand" }) {
  const colors = {
    brand: "text-brand-700 bg-brand-50",
    green: "text-emerald-700 bg-emerald-50",
    red: "text-red-700 bg-red-50",
    amber: "text-amber-700 bg-amber-50",
  };
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${colors[color].split(" ")[0]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const [s, setS] = useState(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setS)
      .catch(() => {});
  }, []);

  if (!s) return <div className="text-slate-400">{t("common.loading")}</div>;

  const months = t("dashboard.months");
  const maxBar = Math.max(1, ...s.monthly.map((m) => Math.max(m.revenue, m.expenses)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("dashboard.title")}</h1>
          <p className="text-slate-500 text-sm">{t("dashboard.subtitle", { year: s.year })}</p>
        </div>
        <Link href="/parastatika/neo" className="btn-primary">
          <Icon name="plus" size={16} /> {t("dashboard.newInvoice")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("dashboard.monthRevenue")} value={money(s.monthRevenue)} sub={t("dashboard.yearRevenue", { value: money(s.yearRevenue) })} color="brand" />
        <Stat label={t("dashboard.monthExpenses")} value={money(s.monthExpenses)} sub={t("dashboard.yearRevenue", { value: money(s.yearExpenses) })} color="red" />
        <Stat label={t("dashboard.monthProfit")} value={money(s.monthProfit)} sub={t("dashboard.profitSub")} color="green" />
        <Stat
          label={t("dashboard.monthVatBalance")}
          value={money(s.vatBalance)}
          sub={t("dashboard.vatSub", { collected: money(s.monthVatCollected), paid: money(s.monthVatPaid) })}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Γράφημα */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">{t("dashboard.chartTitle")}</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-500 inline-block"></span> {t("dashboard.chartRevenue")}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block"></span> {t("dashboard.chartExpenses")}</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-48">
            {s.monthly.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center gap-0.5 h-40">
                  <div
                    className="w-1/2 bg-brand-500 rounded-t"
                    style={{ height: `${(m.revenue / maxBar) * 100}%` }}
                    title={money(m.revenue)}
                  ></div>
                  <div
                    className="w-1/2 bg-red-400 rounded-t"
                    style={{ height: `${(m.expenses / maxBar) * 100}%` }}
                    title={money(m.expenses)}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-400">{months[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Πλευρικά */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-3">{t("dashboard.unpaid")}</h2>
            <div className="text-2xl font-bold text-amber-600">{money(s.unpaidTotal)}</div>
            <div className="text-sm text-slate-500">{t("dashboard.unpaidSub", { count: s.unpaidCount })}</div>
          </div>

          <Link href="/ergasies" className="card p-5 block hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-slate-800 flex items-center gap-1.5"><Icon name="jobs" size={16} className="text-slate-400" /> {t("dashboard.activeJobs")}</h2>
              <span className="text-brand-600 text-xs">{t("dashboard.board")}</span>
            </div>
            <div className="text-2xl font-bold text-brand-700">{s.activeJobs ?? 0}</div>
            {s.overdueJobs > 0 && <div className="text-sm text-red-600 font-medium">{t("dashboard.overdueJobs", { count: s.overdueJobs })}</div>}
          </Link>

          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Icon name="bell" size={16} className="text-slate-400" /> {t("dashboard.reminders")}</h2>
            {(!s.reminders || s.reminders.length === 0) ? (
              <p className="text-sm text-slate-400">{t("dashboard.noReminders")}</p>
            ) : (
              <ul className="space-y-2">
                {s.reminders.map((r) => {
                  const overdue = r.dueDate && r.dueDate < new Date().toISOString().slice(0, 10);
                  return (
                    <li key={r.id} className="flex justify-between items-start text-sm gap-2">
                      <div className="min-w-0">
                        <div className="text-slate-700 truncate">{r.title || r.note}</div>
                        <div className="text-xs text-slate-400 truncate">{r.customerName}</div>
                      </div>
                      <span className={`badge shrink-0 ${overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{r.dueDate ? formatDate(r.dueDate) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">{t("dashboard.lowStock")}</h2>
              <Link href="/apothiki" className="text-xs text-brand-600 hover:underline">{t("common.all")}</Link>
            </div>
            {s.lowStock.length === 0 ? (
              <p className="text-sm text-slate-400">{t("dashboard.allGood")}</p>
            ) : (
              <ul className="space-y-2">
                {s.lowStock.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span className="text-slate-700 truncate">{p.name}</span>
                    <span className="badge bg-red-100 text-red-700">{p.stock} {p.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Πρόσφατα παραστατικά */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">{t("dashboard.recentInvoices")}</h2>
            <Link href="/parastatika" className="text-xs text-brand-600 hover:underline">{t("common.all")}</Link>
          </div>
          {s.recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-400">{t("dashboard.noInvoicesYet")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.recentInvoices.map((i) => (
                <li key={i.id} className="py-2 flex items-center justify-between">
                  <div>
                    <Link href={`/parastatika/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.number}</Link>
                    <div className="text-xs text-slate-400">{i.customer?.name || t("common.retail")} · {formatDate(i.date)}</div>
                  </div>
                  <span className="font-semibold text-slate-700">{money(i.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Κορυφαία προϊόντα */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-3">{t("dashboard.topProducts")}</h2>
          {s.topProducts.length === 0 ? (
            <p className="text-sm text-slate-400">{t("dashboard.noSalesYet")}</p>
          ) : (
            <ul className="space-y-2">
              {s.topProducts.map((p, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate">{i + 1}. {p.name}</span>
                  <span className="text-slate-500">{t("dashboard.qtyUnit", { qty: p.qty })} · <b className="text-slate-700">{money(p.revenue)}</b></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
