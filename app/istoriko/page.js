"use client";

import { useEffect, useMemo, useState } from "react";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const ACTION_ICON = {
  login: "lock",
  login_failed: "lock",
  logout: "lock",
  sale: "cart",
  shift_open: "box",
  shift_close: "box",
  stock_receive: "box",
  product_create: "tag",
  product_update: "edit",
  product_delete: "trash",
  staff_create: "users",
  staff_delete: "users",
};

export default function ActivityLogPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState(null);
  const [settings, setSettings] = useState(null);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    fetch("/api/activity-log").then((r) => (r.ok ? r.json() : [])).then(setEntries);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const cur = settings?.currency || "€";

  const describe = (e) => {
    const d = e.details || {};
    switch (e.action) {
      case "login": return t("activity.descLogin");
      case "login_failed": return t("activity.descLoginFailed", { username: d.username || "?" });
      case "logout": return t("activity.descLogout");
      case "sale": return t("activity.descSale", { number: d.number, total: money(d.total, cur), method: t(`common.paymentMethods.${d.paymentMethod}`) || d.paymentMethod });
      case "shift_open": return t("activity.descShiftOpen", { float: money(d.openingFloat, cur) });
      case "shift_close": return t("activity.descShiftClose", { expected: money(d.expectedCash, cur), counted: money(d.countedCash, cur), diff: money(d.difference, cur) });
      case "stock_receive": return t("activity.descStockReceive", { number: d.number, qty: d.totalQty });
      case "product_create": return t("activity.descProductCreate", { name: d.name });
      case "product_update": return t("activity.descProductUpdate", { name: d.name });
      case "product_delete": return t("activity.descProductDelete", { name: d.name });
      case "staff_create": return t("activity.descStaffCreate", { username: d.targetUsername, role: d.role });
      case "staff_delete": return t("activity.descStaffDelete", { username: d.targetUsername });
      default: return e.action;
    }
  };

  const actionOptions = useMemo(() => Array.from(new Set((entries || []).map((e) => e.action))).sort(), [entries]);
  const userOptions = useMemo(() => Array.from(new Set((entries || []).map((e) => e.username).filter(Boolean))).sort(), [entries]);

  const filtered = (entries || []).filter((e) => {
    if (actionFilter && e.action !== actionFilter) return false;
    if (userFilter && e.username !== userFilter) return false;
    return true;
  });

  if (!entries) return <div className="text-slate-400">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("activity.title")}</h1>
        <p className="text-slate-500 text-sm">{t("activity.subtitle")}</p>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <select className="input max-w-[200px]" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          <option value="">{t("activity.allUsers")}</option>
          {userOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="input max-w-[220px]" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">{t("activity.allActions")}</option>
          {actionOptions.map((a) => <option key={a} value={a}>{t(`activity.action.${a}`) || a}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">{t("activity.colTime")}</th>
                <th className="table-th">{t("activity.colUser")}</th>
                <th className="table-th">{t("activity.colRole")}</th>
                <th className="table-th">{t("activity.colDetails")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td className="table-td text-slate-400" colSpan={4}>{t("activity.noEntries")}</td></tr>
              ) : filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="table-td text-slate-500 whitespace-nowrap">{new Date(e.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="table-td font-medium">{e.username || "—"}</td>
                  <td className="table-td">
                    {e.role && <span className="badge bg-slate-100 text-slate-600">{t(`settings.role${e.role.charAt(0).toUpperCase()}${e.role.slice(1)}`) || e.role}</span>}
                  </td>
                  <td className="table-td text-slate-700">
                    <span className="inline-flex items-center gap-1.5"><Icon name={ACTION_ICON[e.action] || "note"} size={14} className="text-slate-400" /> {describe(e)}</span>
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
