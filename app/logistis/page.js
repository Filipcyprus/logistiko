"use client";

import { useEffect, useState } from "react";
import { money, formatDate, todayISO } from "@/lib/format";
import Icon from "@/components/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return todayISO(); }

const PO_STATUS_COLOR = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-sky-100 text-sky-700",
  received: "bg-emerald-100 text-emerald-700",
};

const emptyLine = () => ({ accountId: "", debit: "", credit: "", memo: "" });

export default function AccountantPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("invoices");
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [tbDate, setTbDate] = useState(today());
  const [tb, setTb] = useState(null);
  const [loadingTb, setLoadingTb] = useState(false);

  const [jFrom, setJFrom] = useState(firstOfMonth());
  const [jTo, setJTo] = useState(today());
  const [jQuery, setJQuery] = useState("");
  const [journal, setJournal] = useState(null);
  const [loadingJournal, setLoadingJournal] = useState(false);

  const [plFrom, setPlFrom] = useState(firstOfMonth());
  const [plTo, setPlTo] = useState(today());
  const [pl, setPl] = useState(null);
  const [loadingPl, setLoadingPl] = useState(false);

  const [bsDate, setBsDate] = useState(today());
  const [bs, setBs] = useState(null);
  const [loadingBs, setLoadingBs] = useState(false);

  const [glAccount, setGlAccount] = useState("");
  const [glFrom, setGlFrom] = useState(firstOfMonth());
  const [glTo, setGlTo] = useState(today());
  const [gl, setGl] = useState(null);
  const [loadingGl, setLoadingGl] = useState(false);

  const [jeDate, setJeDate] = useState(today());
  const [jeMemo, setJeMemo] = useState("");
  const [jeLines, setJeLines] = useState([emptyLine(), emptyLine()]);
  const [jePosting, setJePosting] = useState(false);
  const [jeResult, setJeResult] = useState(null);

  useEffect(() => {
    fetch("/api/accountant").then((r) => r.json()).then(setData);
    fetch("/api/accounts").then((r) => (r.ok ? r.json() : [])).then((list) => {
      setAccounts(list);
      if (list.length > 0) setGlAccount((cur) => cur || list[0].id);
    });
  }, []);

  // Ονομασία λογαριασμού: ο χρήστης μπορεί να τη μετονομάσει (name)· αλλιώς δείχνουμε τη
  // μεταφρασμένη ονομασία του ενσωματωμένου λογαριασμού.
  const accName = (a) => (a?.name ? a.name : a?.nameKey ? t(a.nameKey) : "");
  const rowName = (r) => (r.name ? r.name : r.nameKey ? t(r.nameKey) : "");

  const loadReport = () => {
    setLoadingReport(true);
    fetch(`/api/reports?from=${from}&to=${to}`).then((r) => r.json()).then(setReport).finally(() => setLoadingReport(false));
  };
  useEffect(() => { if (tab === "vat" && !report) loadReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const loadTrialBalance = () => {
    setLoadingTb(true);
    fetch(`/api/trial-balance?to=${tbDate}`).then((r) => r.json()).then(setTb).finally(() => setLoadingTb(false));
  };
  useEffect(() => { if (tab === "trial" && !tb) loadTrialBalance(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const loadJournal = (page = 1) => {
    setLoadingJournal(true);
    const qs = `from=${jFrom}&to=${jTo}&page=${page}&pageSize=50${jQuery ? `&q=${encodeURIComponent(jQuery)}` : ""}`;
    fetch(`/api/journal?${qs}`).then((r) => r.json()).then(setJournal).finally(() => setLoadingJournal(false));
  };
  useEffect(() => { if (tab === "journal" && !journal) loadJournal(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const loadPl = () => {
    setLoadingPl(true);
    fetch(`/api/profit-loss?from=${plFrom}&to=${plTo}`).then((r) => r.json()).then(setPl).finally(() => setLoadingPl(false));
  };
  useEffect(() => { if (tab === "pl" && !pl) loadPl(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const loadBs = () => {
    setLoadingBs(true);
    fetch(`/api/balance-sheet?to=${bsDate}`).then((r) => r.json()).then(setBs).finally(() => setLoadingBs(false));
  };
  useEffect(() => { if (tab === "bs" && !bs) loadBs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const loadGl = () => {
    if (!glAccount) return;
    setLoadingGl(true);
    fetch(`/api/general-ledger?accountId=${glAccount}&from=${glFrom}&to=${glTo}`).then((r) => r.json()).then(setGl).finally(() => setLoadingGl(false));
  };
  useEffect(() => { if (tab === "gl" && !gl && glAccount) loadGl(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, glAccount]);

  // --- Χειροκίνητο άρθρο ---
  const setJeLine = (idx, patch) => setJeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const jeDebitTotal = Math.round(jeLines.reduce((a, l) => a + (Number(l.debit) || 0), 0) * 100) / 100;
  const jeCreditTotal = Math.round(jeLines.reduce((a, l) => a + (Number(l.credit) || 0), 0) * 100) / 100;
  const jeDiff = Math.round((jeDebitTotal - jeCreditTotal) * 100) / 100;
  const jeBalanced = Math.abs(jeDiff) < 0.005 && jeDebitTotal > 0;

  const postJe = async () => {
    setJePosting(true);
    setJeResult(null);
    const lines = jeLines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo }));
    const res = await fetch("/api/journal-entries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: jeDate, memo: jeMemo, lines }),
    });
    setJePosting(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setJeResult({ ok: true, number: body.number });
      setJeMemo("");
      setJeLines([emptyLine(), emptyLine()]);
      setTb(null); setPl(null); setBs(null); setGl(null); setJournal(null);
    } else {
      setJeResult({ ok: false, error: body.error ? t(body.error) : t("common.error") });
    }
  };

  const reverseEntry = async (entry) => {
    if (!confirm(t("manualEntry.confirmReverse", { number: entry.number }))) return;
    const res = await fetch(`/api/journal-entries?reverse=${entry.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayISO() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ? t(body.error) : t("common.error"));
      return;
    }
    setTb(null); setPl(null); setBs(null); setGl(null);
    loadJournal(journal?.page || 1);
  };

  if (!data) return <div className="text-slate-400">{t("common.loading")}</div>;
  const cur = data.settings?.currency || "€";
  const categoryLabel = (key) => t(`expenses.categories.${key}`) || key;

  const TABS = [
    ["invoices", t("accountant.tabInvoices")],
    ["expenses", t("accountant.tabExpenses")],
    ["purchases", t("accountant.tabPurchases")],
    ["vat", t("accountant.tabVat")],
    ["trial", t("accountant.tabTrialBalance")],
    ["journal", t("accountant.tabJournal")],
    ["entry", t("accountant.tabManualEntry")],
    ["pl", t("accountant.tabProfitLoss")],
    ["bs", t("accountant.tabBalanceSheet")],
    ["gl", t("accountant.tabGeneralLedger")],
  ];

  // Κοινή γραμμή λογαριασμού για τις καταστάσεις: "1000  Ταμείο ........ 123,45 €"
  const AccountRow = ({ row, value }) => (
    <tr>
      <td className="table-td">
        <span className="text-slate-400 mr-1.5 font-mono text-xs">{row.number}</span>
        {rowName(row)}
      </td>
      <td className="table-td text-right">{money(value ?? row.balance, cur)}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("accountant.title")}</h1>
        <p className="text-slate-500 text-sm">{t("accountant.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 flex-wrap">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{label}</button>
        ))}
      </div>

      {tab === "invoices" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("invoices.colNumber")}</th>
                  <th className="table-th">{t("invoices.colDate")}</th>
                  <th className="table-th">{t("invoices.colCustomer")}</th>
                  <th className="table-th text-right">{t("invoices.colNet")}</th>
                  <th className="table-th text-right">{t("invoices.colVat")}</th>
                  <th className="table-th text-right">{t("invoices.colTotal")}</th>
                  <th className="table-th">{t("invoices.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invoices.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={7}>{t("accountant.noInvoices")}</td></tr>
                ) : data.invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="table-td font-semibold">{i.number}</td>
                    <td className="table-td">{formatDate(i.date)}</td>
                    <td className="table-td">{i.customer || "—"}</td>
                    <td className="table-td text-right">{money(i.net, cur)}</td>
                    <td className="table-td text-right">{money(i.vat, cur)}</td>
                    <td className="table-td text-right font-semibold">{money(i.total, cur)}</td>
                    <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{i.status === "paid" ? t("invoices.statusPaid") : t("invoices.statusUnpaid")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("expenses.colDate")}</th>
                  <th className="table-th">{t("expenses.colCategory")}</th>
                  <th className="table-th">{t("expenses.colDescription")}</th>
                  <th className="table-th">{t("expenses.colSupplier")}</th>
                  <th className="table-th text-right">{t("expenses.colNet")}</th>
                  <th className="table-th text-right">{t("expenses.colVat")}</th>
                  <th className="table-th text-right">{t("expenses.colTotal")}</th>
                  <th className="table-th">{t("expenses.colAttachment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.expenses.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={8}>{t("accountant.noExpenses")}</td></tr>
                ) : data.expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="table-td">{formatDate(e.date)}</td>
                    <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{categoryLabel(e.category)}</span></td>
                    <td className="table-td font-medium">{e.description}</td>
                    <td className="table-td">{e.supplier || "—"}</td>
                    <td className="table-td text-right">{money(e.net, cur)}</td>
                    <td className="table-td text-right">{money(e.vat, cur)}</td>
                    <td className="table-td text-right font-semibold">{money(e.amount, cur)}</td>
                    <td className="table-td">
                      {e.attachment ? (
                        <a href={e.attachment.data} download={e.attachment.name} className="btn-ghost !px-2 !py-1 inline-flex" title={t("expenses.viewInvoice")}><Icon name="download" size={15} /></a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "purchases" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">{t("purchases.colNumber")}</th>
                  <th className="table-th">{t("purchases.colDate")}</th>
                  <th className="table-th">{t("purchases.colSupplier")}</th>
                  <th className="table-th text-right">{t("common.net")}</th>
                  <th className="table-th text-right">{t("common.vat")}</th>
                  <th className="table-th text-right">{t("purchases.colTotal")}</th>
                  <th className="table-th">{t("purchases.colStatus")}</th>
                  <th className="table-th">{t("expenses.colAttachment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.purchases.length === 0 ? (
                  <tr><td className="table-td text-slate-400" colSpan={8}>{t("accountant.noPurchases")}</td></tr>
                ) : data.purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="table-td font-semibold">{po.number}</td>
                    <td className="table-td">{formatDate(po.date)}</td>
                    <td className="table-td">{po.supplier || "—"}</td>
                    <td className="table-td text-right">{money(po.net, cur)}</td>
                    <td className="table-td text-right">{money(po.vat, cur)}</td>
                    <td className="table-td text-right font-semibold">{money(po.total, cur)}</td>
                    <td className="table-td"><span className={`badge ${PO_STATUS_COLOR[po.status] || PO_STATUS_COLOR.draft}`}>{t(`purchases.status${po.status.charAt(0).toUpperCase()}${po.status.slice(1)}`)}</span></td>
                    <td className="table-td">
                      {po.attachment ? (
                        <a href={po.attachment.data} download={po.attachment.name} className="btn-ghost !px-2 !py-1 inline-flex" title={t("expenses.viewInvoice")}><Icon name="download" size={15} /></a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "vat" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <button onClick={loadReport} className="btn-primary">{t("reports.apply")}</button>
          </div>
          {loadingReport || !report ? <div className="text-slate-400">{t("common.loading")}</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.salesTotal")}</div><div className="text-2xl font-bold text-brand-700">{money(report.salesTotal, cur)}</div><div className="text-xs text-slate-400">{t("reports.salesNetSub", { value: money(report.salesNet, cur) })}</div></div>
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.expensesTotal")}</div><div className="text-2xl font-bold text-red-600">{money(report.expensesTotal, cur)}</div><div className="text-xs text-slate-400">{t("reports.salesNetSub", { value: money(report.expensesNet, cur) })}</div></div>
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.profit")}</div><div className="text-2xl font-bold text-emerald-600">{money(report.profit, cur)}</div></div>
              <div className="card p-5"><div className="text-sm text-slate-500">{t("reports.vatBalance")}</div><div className="text-2xl font-bold text-amber-600">{money(report.vatBalance, cur)}</div><div className="text-xs text-slate-400">{t("reports.vatBalanceSub", { collected: money(report.salesVat, cur), paid: money(report.expensesVat, cur) })}</div></div>
            </div>
          )}
        </div>
      )}

      {tab === "trial" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("trialBalance.asOf")}</label><input type="date" className="input" value={tbDate} onChange={(e) => setTbDate(e.target.value)} /></div>
            <button onClick={loadTrialBalance} className="btn-primary">{t("reports.apply")}</button>
          </div>
          {loadingTb || !tb ? <div className="text-slate-400">{t("common.loading")}</div> : (
            <>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="table-th">{t("coa.colNumber")}</th>
                        <th className="table-th">{t("coa.colName")}</th>
                        <th className="table-th">{t("coa.colType")}</th>
                        <th className="table-th text-right">{t("trialBalance.debit")}</th>
                        <th className="table-th text-right">{t("trialBalance.credit")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tb.lines.length === 0 ? (
                        <tr><td className="table-td text-slate-400" colSpan={5}>{t("journal.noEntries")}</td></tr>
                      ) : tb.lines.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="table-td font-mono text-xs text-slate-500">{l.number}</td>
                          <td className="table-td font-medium">{rowName(l)}</td>
                          <td className="table-td text-slate-500 text-xs">{t(`coa.types.${l.type}`)}</td>
                          <td className="table-td text-right">{l.debitBalance ? money(l.debitBalance, cur) : ""}</td>
                          <td className="table-td text-right">{l.creditBalance ? money(l.creditBalance, cur) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 font-bold">
                        <td className="table-td" colSpan={3}>{t("common.total")}</td>
                        <td className="table-td text-right">{money(tb.totalDebit, cur)}</td>
                        <td className="table-td text-right">{money(tb.totalCredit, cur)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {!tb.balanced && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{t("trialBalance.mismatch")}</div>}

              <div className="card p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{t("trialBalance.physicalInventoryTitle")}</span>
                  <span className="font-semibold">{money(tb.physicalInventoryValue, cur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{t("trialBalance.inventoryVarianceLabel")}</span>
                  <span className={`font-semibold ${Math.abs(tb.inventoryVariance) > 0.01 ? "text-amber-600" : "text-emerald-600"}`}>{money(tb.inventoryVariance, cur)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">{t("trialBalance.note")}</p>
            </>
          )}
        </div>
      )}

      {tab === "journal" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={jFrom} onChange={(e) => setJFrom(e.target.value)} /></div>
            <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={jTo} onChange={(e) => setJTo(e.target.value)} /></div>
            <div className="flex-1 min-w-[180px]"><label className="label">{t("journal.search")}</label><input className="input" value={jQuery} onChange={(e) => setJQuery(e.target.value)} placeholder={t("journal.searchPlaceholder")} /></div>
            <button onClick={() => loadJournal(1)} className="btn-primary">{t("reports.apply")}</button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">{t("journal.colEntryNo")}</th>
                    <th className="table-th">{t("journal.colDate")}</th>
                    <th className="table-th">{t("journal.colDescription")}</th>
                    <th className="table-th">{t("manualEntry.colAccount")}</th>
                    <th className="table-th text-right">{t("journal.colDebit")}</th>
                    <th className="table-th text-right">{t("journal.colCredit")}</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingJournal ? (
                    <tr><td className="table-td text-slate-400" colSpan={7}>{t("common.loading")}</td></tr>
                  ) : !journal || journal.entries.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={7}>{t("journal.noEntries")}</td></tr>
                  ) : journal.entries.map((jv) => (
                    jv.lines.map((line, li) => (
                      <tr key={`${jv.id}-${li}`} className={li === 0 ? "border-t-2 border-slate-200" : ""}>
                        {li === 0 && (
                          <td className="table-td align-top font-semibold font-mono text-xs" rowSpan={jv.lines.length}>
                            {jv.number}
                            {jv.reversedBy && <div className="badge bg-amber-100 text-amber-700 mt-1">{t("manualEntry.reversedBadge")}</div>}
                            {jv.reversalOf && <div className="badge bg-slate-100 text-slate-600 mt-1">{t("manualEntry.reversalBadge")}</div>}
                          </td>
                        )}
                        {li === 0 && <td className="table-td align-top" rowSpan={jv.lines.length}>{formatDate(jv.date)}</td>}
                        {li === 0 && (
                          <td className="table-td align-top" rowSpan={jv.lines.length}>
                            {jv.memoKey ? t(jv.memoKey, jv.memoParams) : jv.memo || "—"}
                          </td>
                        )}
                        <td className="table-td text-slate-600">
                          <span className="text-slate-400 mr-1.5 font-mono text-xs">{line.accountNumber}</span>
                          {line.accountName || (line.accountNameKey ? t(line.accountNameKey) : "")}
                          {line.itemLabel && <span className="text-xs text-slate-400"> ({line.itemLabel})</span>}
                        </td>
                        <td className="table-td text-right">{line.debit ? money(line.debit, cur) : ""}</td>
                        <td className="table-td text-right">{line.credit ? money(line.credit, cur) : ""}</td>
                        {li === 0 && (
                          <td className="table-td align-top text-right" rowSpan={jv.lines.length}>
                            {!jv.reversedBy && !jv.reversalOf && (
                              <button onClick={() => reverseEntry(jv)} className="btn-ghost !px-2 !py-1 text-xs text-amber-700">{t("manualEntry.reverse")}</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
            {journal && journal.total > 0 && (
              <div className="flex items-center justify-between gap-3 p-3 border-t border-slate-200 text-sm">
                <span className="text-slate-500">{t("journal.pageInfo", { page: journal.page, pages: journal.pageCount, count: journal.total })}</span>
                <div className="flex gap-2">
                  <button onClick={() => loadJournal(journal.page - 1)} disabled={journal.page <= 1} className="btn-secondary !px-3 !py-1 disabled:opacity-40">{t("journal.prevPage")}</button>
                  <button onClick={() => loadJournal(journal.page + 1)} disabled={journal.page >= journal.pageCount} className="btn-secondary !px-3 !py-1 disabled:opacity-40">{t("journal.nextPage")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "entry" && (
        <div className="space-y-4 max-w-4xl">
          <p className="text-sm text-slate-500">{t("manualEntry.subtitle")}</p>

          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("manualEntry.date")}</label><input type="date" className="input" value={jeDate} onChange={(e) => setJeDate(e.target.value)} /></div>
            <div className="flex-1 min-w-[220px]"><label className="label">{t("manualEntry.memo")}</label><input className="input" value={jeMemo} onChange={(e) => setJeMemo(e.target.value)} placeholder={t("manualEntry.memoPlaceholder")} /></div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">{t("manualEntry.colAccount")}</th>
                    <th className="table-th">{t("manualEntry.colMemo")}</th>
                    <th className="table-th text-right w-32">{t("journal.colDebit")}</th>
                    <th className="table-th text-right w-32">{t("journal.colCredit")}</th>
                    <th className="table-th w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jeLines.map((l, idx) => (
                    <tr key={idx}>
                      <td className="table-td">
                        <select className="input !py-1" value={l.accountId} onChange={(e) => setJeLine(idx, { accountId: e.target.value })}>
                          <option value="">{t("manualEntry.selectAccount")}</option>
                          {accounts.filter((a) => a.active !== false).map((a) => (
                            <option key={a.id} value={a.id}>{a.number} — {accName(a)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="table-td"><input className="input !py-1" value={l.memo} onChange={(e) => setJeLine(idx, { memo: e.target.value })} /></td>
                      <td className="table-td"><input type="number" step="any" min="0" className="input !py-1 text-right" value={l.debit} onChange={(e) => setJeLine(idx, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></td>
                      <td className="table-td"><input type="number" step="any" min="0" className="input !py-1 text-right" value={l.credit} onChange={(e) => setJeLine(idx, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></td>
                      <td className="table-td text-right">
                        <button onClick={() => setJeLines((prev) => prev.filter((_, i) => i !== idx))} disabled={jeLines.length <= 2} className="btn-ghost !px-2 !py-1 text-red-500 disabled:opacity-30"><Icon name="x" size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td className="table-td" colSpan={2}>{t("manualEntry.totals")}</td>
                    <td className="table-td text-right">{money(jeDebitTotal, cur)}</td>
                    <td className="table-td text-right">{money(jeCreditTotal, cur)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td className="table-td text-slate-500" colSpan={2}>{t("manualEntry.difference")}</td>
                    <td className="table-td text-right" colSpan={2}>
                      <span className={jeBalanced ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
                        {money(jeDiff, cur)} · {jeBalanced ? t("manualEntry.balanced") : t("manualEntry.notBalanced")}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button onClick={() => setJeLines((prev) => [...prev, emptyLine()])} className="btn-secondary"><Icon name="plus" size={15} /> {t("manualEntry.addLine")}</button>
              <button onClick={postJe} disabled={!jeBalanced || jePosting} className="btn-primary disabled:opacity-40">{jePosting ? t("manualEntry.posting") : t("manualEntry.post")}</button>
            </div>
          </div>

          {jeResult && (
            <div className={`text-sm rounded-lg px-3 py-2 ${jeResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {jeResult.ok ? t("manualEntry.posted", { number: jeResult.number }) : jeResult.error}
            </div>
          )}
        </div>
      )}

      {tab === "pl" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={plFrom} onChange={(e) => setPlFrom(e.target.value)} /></div>
            <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={plTo} onChange={(e) => setPlTo(e.target.value)} /></div>
            <button onClick={loadPl} className="btn-primary">{t("reports.apply")}</button>
          </div>
          {loadingPl || !pl ? <div className="text-slate-400">{t("common.loading")}</div> : (
            <div className="card overflow-hidden max-w-2xl">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50"><td className="table-td font-semibold" colSpan={2}>{t("profitLoss.salesNet")}</td></tr>
                  {pl.income.map((r) => <AccountRow key={r.id} row={r} />)}
                  <tr className="border-t border-slate-200 font-semibold"><td className="table-td">{t("profitLoss.totalIncome")}</td><td className="table-td text-right">{money(pl.totalIncome, cur)}</td></tr>

                  <tr className="bg-slate-50"><td className="table-td font-semibold" colSpan={2}>{t("profitLoss.cogs")}</td></tr>
                  {pl.cogsRows.map((r) => <AccountRow key={r.id} row={r} />)}
                  <tr className="border-t-2 border-slate-300 font-bold"><td className="table-td">{t("profitLoss.grossProfit")}</td><td className="table-td text-right">{money(pl.grossProfit, cur)}</td></tr>

                  <tr className="bg-slate-50"><td className="table-td font-semibold" colSpan={2}>{t("profitLoss.expensesNet")}</td></tr>
                  {pl.opexRows.length === 0 ? (
                    <tr><td className="table-td text-slate-400" colSpan={2}>—</td></tr>
                  ) : pl.opexRows.map((r) => <AccountRow key={r.id} row={r} />)}
                  <tr className="border-t border-slate-200 font-semibold"><td className="table-td">{t("profitLoss.totalOpex")}</td><td className="table-td text-right">{money(pl.totalOpex, cur)}</td></tr>

                  <tr className="border-t-2 border-slate-300 font-bold text-base">
                    <td className="table-td">{t("profitLoss.netIncome")}</td>
                    <td className={`table-td text-right ${pl.netIncome < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(pl.netIncome, cur)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "bs" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div><label className="label">{t("trialBalance.asOf")}</label><input type="date" className="input" value={bsDate} onChange={(e) => setBsDate(e.target.value)} /></div>
            <button onClick={loadBs} className="btn-primary">{t("reports.apply")}</button>
          </div>
          {loadingBs || !bs ? <div className="text-slate-400">{t("common.loading")}</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-600">{t("profitLoss.assets")}</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {bs.assets.length === 0 ? <tr><td className="table-td text-slate-400" colSpan={2}>—</td></tr> : bs.assets.map((r) => <AccountRow key={r.id} row={r} />)}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold"><td className="table-td">{t("profitLoss.totalAssets")}</td><td className="table-td text-right">{money(bs.totalAssets, cur)}</td></tr>
                  </tfoot>
                </table>
              </div>
              <div className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-600">{t("profitLoss.liabilitiesAndEquity")}</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {bs.liabilities.map((r) => <AccountRow key={r.id} row={r} />)}
                    <tr className="border-t border-slate-200 font-semibold"><td className="table-td">{t("profitLoss.totalLiabilities")}</td><td className="table-td text-right">{money(bs.totalLiabilities, cur)}</td></tr>
                    {bs.equity.map((r) => <AccountRow key={r.id} row={r} />)}
                    <tr><td className="table-td">{t("profitLoss.currentEarnings")}</td><td className="table-td text-right">{money(bs.netIncome, cur)}</td></tr>
                    <tr className="border-t border-slate-200 font-semibold"><td className="table-td">{t("profitLoss.totalEquity")}</td><td className="table-td text-right">{money(bs.totalEquity, cur)}</td></tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold"><td className="table-td">{t("profitLoss.totalLiabilitiesAndEquity")}</td><td className="table-td text-right">{money(bs.totalLiabilitiesAndEquity, cur)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "gl" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">{t("generalLedger.account")}</label>
              <select className="input" value={glAccount} onChange={(e) => setGlAccount(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.number} — {accName(a)}</option>)}
              </select>
            </div>
            <div><label className="label">{t("reports.from")}</label><input type="date" className="input" value={glFrom} onChange={(e) => setGlFrom(e.target.value)} /></div>
            <div><label className="label">{t("reports.to")}</label><input type="date" className="input" value={glTo} onChange={(e) => setGlTo(e.target.value)} /></div>
            <button onClick={loadGl} className="btn-primary">{t("reports.apply")}</button>
          </div>
          {loadingGl || !gl ? <div className="text-slate-400">{t("common.loading")}</div> : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="table-th">{t("journal.colDate")}</th>
                      <th className="table-th">{t("journal.colEntryNo")}</th>
                      <th className="table-th">{t("journal.colDescription")}</th>
                      <th className="table-th text-right">{t("journal.colDebit")}</th>
                      <th className="table-th text-right">{t("journal.colCredit")}</th>
                      <th className="table-th text-right">{t("generalLedger.balance")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="table-td" colSpan={5}>{t("generalLedger.openingBalance")}</td>
                      <td className="table-td text-right font-semibold">{money(gl.openingBalance, cur)}</td>
                    </tr>
                    {gl.rows.length === 0 ? (
                      <tr><td className="table-td text-slate-400" colSpan={6}>{t("journal.noEntries")}</td></tr>
                    ) : gl.rows.map((r) => (
                      <tr key={r.entryId} className="hover:bg-slate-50">
                        <td className="table-td">{formatDate(r.date)}</td>
                        <td className="table-td font-mono text-xs text-slate-500">{r.number}</td>
                        <td className="table-td">
                          {r.memoKey ? t(r.memoKey, r.memoParams) : r.memo || "—"}
                          {r.itemLabel && <span className="text-xs text-slate-400"> ({r.itemLabel})</span>}
                        </td>
                        <td className="table-td text-right">{r.debit ? money(r.debit, cur) : ""}</td>
                        <td className="table-td text-right">{r.credit ? money(r.credit, cur) : ""}</td>
                        <td className="table-td text-right">{money(r.balance, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold">
                      <td className="table-td" colSpan={5}>{t("generalLedger.closingBalance")}</td>
                      <td className="table-td text-right">{money(gl.closingBalance, cur)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
