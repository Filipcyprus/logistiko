import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Αναφορές για συγκεκριμένη περίοδο: ?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";

  const inRange = (d) => d >= from && d <= to;
  const invoices = (db.invoices || []).filter((i) => inRange(i.date));
  const expenses = (db.expenses || []).filter((e) => inRange(e.date));

  const sum = (arr, f) => Math.round(arr.reduce((a, x) => a + Number(f(x) || 0), 0) * 100) / 100;

  // ΦΠΑ
  const vatCollected = sum(invoices, (i) => i.vat);
  const vatPaid = sum(expenses, (e) => e.vat);

  // Ανά πελάτη
  const retailLabel = serverT(db.settings.language, "common.retail");
  const byCustomerMap = {};
  for (const i of invoices) {
    const key = i.customer?.name || retailLabel;
    if (!byCustomerMap[key]) byCustomerMap[key] = { name: key, count: 0, net: 0, vat: 0, total: 0 };
    byCustomerMap[key].count++;
    byCustomerMap[key].net += Number(i.net);
    byCustomerMap[key].vat += Number(i.vat);
    byCustomerMap[key].total += Number(i.total);
  }
  const byCustomer = Object.values(byCustomerMap).sort((a, b) => b.total - a.total);

  // Ανά είδος
  const byProductMap = {};
  for (const i of invoices) {
    for (const it of i.items || []) {
      const key = it.description;
      const net = Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount || 0) / 100);
      if (!byProductMap[key]) byProductMap[key] = { name: key, qty: 0, net: 0 };
      byProductMap[key].qty += Number(it.quantity);
      byProductMap[key].net += net;
    }
  }
  const byProduct = Object.values(byProductMap)
    .map((x) => ({ ...x, net: Math.round(x.net * 100) / 100 }))
    .sort((a, b) => b.net - a.net);

  // Ανά κατηγορία εξόδων
  const byExpenseCatMap = {};
  for (const e of expenses) {
    const key = e.category || "general";
    if (!byExpenseCatMap[key]) byExpenseCatMap[key] = { name: key, amount: 0, count: 0 };
    byExpenseCatMap[key].amount += Number(e.amount);
    byExpenseCatMap[key].count++;
  }
  const byExpenseCategory = Object.values(byExpenseCatMap)
    .map((x) => ({ ...x, amount: Math.round(x.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    from, to,
    salesNet: sum(invoices, (i) => i.net),
    salesVat: vatCollected,
    salesTotal: sum(invoices, (i) => i.total),
    invoiceCount: invoices.length,
    expensesNet: sum(expenses, (e) => e.net || e.amount),
    expensesVat: vatPaid,
    expensesTotal: sum(expenses, (e) => e.amount),
    vatBalance: Math.round((vatCollected - vatPaid) * 100) / 100,
    profit: Math.round((sum(invoices, (i) => i.net) - sum(expenses, (e) => e.net || e.amount)) * 100) / 100,
    byCustomer,
    byProduct,
    byExpenseCategory,
  });
}
