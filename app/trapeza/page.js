"use client";

import { useEffect, useMemo, useState } from "react";
import { money, formatDate } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

// Αναμένει CSV: ημερομηνία,ποσό,περιγραφή (μία γραμμή ανά κίνηση). Την εξάγει η ίδια η τράπεζα.
function parseStatement(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const parts = line.split(",");
      const date = (parts[0] || "").trim();
      const amount = Number((parts[1] || "").replace(/[^\d.-]/g, ""));
      const description = parts.slice(2).join(",").trim();
      return { key: idx, date, amount, description, valid: !!date && !Number.isNaN(amount) };
    });
}

export default function BankReconciliationPage() {
  const { t } = useLanguage();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statementText, setStatementText] = useState("");
  const [manualPick, setManualPick] = useState({}); // { [lineKey]: entryId }

  const load = () => {
    setLoading(true);
    fetch(`/api/bank-reconciliation?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setEntries)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const lines = useMemo(() => parseStatement(statementText), [statementText]);

  // Αυτόματη αντιστοίχιση: ίδιο ποσό (±0,01) με μη-συμφωνημένη κίνηση, χωρίς ήδη επιλεγμένη αντιστοίχιση.
  const autoMatches = useMemo(() => {
    const unreconciled = entries.filter((e) => !e.reconciled);
    const usedEntryIds = new Set(Object.values(manualPick));
    const result = {};
    for (const line of lines) {
      if (!line.valid) continue;
      const candidates = unreconciled.filter(
        (e) => Math.abs(e.amount - line.amount) < 0.01 && !usedEntryIds.has(e.id)
      );
      if (candidates.length === 1) result[line.key] = candidates[0].id;
    }
    return result;
  }, [lines, entries, manualPick]);

  const matchFor = (lineKey) => manualPick[lineKey] ?? autoMatches[lineKey] ?? "";

  const confirmMatch = async (lineKey) => {
    const entryId = matchFor(lineKey);
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    await fetch("/api/bank-reconciliation", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: entry.type, id: entry.id, reconciled: true }),
    });
    load();
  };

  const unreconcile = async (entry) => {
    await fetch("/api/bank-reconciliation", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: entry.type, id: entry.id, reconciled: false }),
    });
    load();
  };

  const matchedCount = entries.filter((e) => e.reconciled).length;
  const cur = "€";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("bankRecon.title")}</h1>
        <p className="text-slate-500 text-sm">{t("bankRecon.subtitle")}</p>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button onClick={load} className="btn-primary">{t("reports.apply")}</button>
        <div className="ml-auto text-sm text-slate-500">{t("bankRecon.matchedCount", { matched: matchedCount, total: entries.length })}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Επικόλληση κίνησης τράπεζας */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-700">{t("bankRecon.statementTitle")}</h2>
          <p className="text-sm text-slate-500">{t("bankRecon.statementHelp")}</p>
          <textarea
            className="input h-40 font-mono text-xs"
            placeholder={"2026-07-15,150.00,ΙΩΑΝΝΟΥ Α\n2026-07-16,89.90,ΓΕΩΡΓΙΟΥ Μ"}
            value={statementText}
            onChange={(e) => setStatementText(e.target.value)}
          />
          {lines.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {lines.map((line) => {
                const chosenId = matchFor(line.key);
                const chosen = entries.find((e) => e.id === chosenId);
                const isAuto = !manualPick[line.key] && autoMatches[line.key];
                return (
                  <div key={line.key} className="p-3 flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{line.date} — {money(line.amount, cur)}</div>
                      <div className="text-xs text-slate-400 truncate">{line.description}</div>
                    </div>
                    <select
                      className="input !py-1 !w-40 text-xs"
                      value={chosenId || ""}
                      onChange={(e) => setManualPick((prev) => ({ ...prev, [line.key]: e.target.value }))}
                    >
                      <option value="">{t("bankRecon.noMatch")}</option>
                      {entries.filter((e) => !e.reconciled).map((e) => (
                        <option key={e.id} value={e.id}>{e.label || e.ref} — {money(e.amount, cur)}</option>
                      ))}
                    </select>
                    {chosen && (
                      <button onClick={() => confirmMatch(line.key)} className={`btn-secondary !py-1 text-xs ${isAuto ? "!bg-emerald-50 !text-emerald-700" : ""}`}>
                        <Icon name="check" size={13} /> {t("bankRecon.confirm")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Καταχωρημένες κινήσεις "τραπεζικό έμβασμα" */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200"><h2 className="font-semibold text-slate-700">{t("bankRecon.recordedTitle")}</h2></div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="table-th">{t("reports.from")}</th>
                  <th className="table-th">{t("bankRecon.colWho")}</th>
                  <th className="table-th text-right">{t("bankRecon.colAmount")}</th>
                  <th className="table-th">{t("bankRecon.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td className="table-td text-slate-400" colSpan={4}>{t("common.loading")}</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={4}>{t("bankRecon.noEntries")}</td></tr>
                ) : entries.map((e) => (
                  <tr key={`${e.type}-${e.id}`} className="hover:bg-slate-50">
                    <td className="table-td">{formatDate(e.date)}</td>
                    <td className="table-td">{e.label || e.ref || "—"}</td>
                    <td className="table-td text-right font-medium">{money(e.amount, cur)}</td>
                    <td className="table-td">
                      {e.reconciled ? (
                        <button onClick={() => unreconcile(e)} className="badge bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                          <Icon name="check" size={11} /> {t("bankRecon.reconciled")}
                        </button>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700">{t("bankRecon.pending")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
