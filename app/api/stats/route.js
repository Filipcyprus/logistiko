import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET() {
  const db = readDB();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const inMonth = (iso) => {
    const d = new Date(iso);
    return d.getFullYear() === y && d.getMonth() === m;
  };
  const inYear = (iso) => new Date(iso).getFullYear() === y;

  const invoices = db.invoices || [];
  const expenses = db.expenses || [];

  const sum = (arr, f) => arr.reduce((a, x) => a + Number(f(x) || 0), 0);

  const monthRevenue = sum(invoices.filter((i) => inMonth(i.date)), (i) => i.total);
  const yearRevenue = sum(invoices.filter((i) => inYear(i.date)), (i) => i.total);
  const monthRevenueNet = sum(invoices.filter((i) => inMonth(i.date)), (i) => i.net);
  const monthVatCollected = sum(invoices.filter((i) => inMonth(i.date)), (i) => i.vat);

  const monthExpenses = sum(expenses.filter((e) => inMonth(e.date)), (e) => e.amount);
  const yearExpenses = sum(expenses.filter((e) => inYear(e.date)), (e) => e.amount);
  const monthVatPaid = sum(expenses.filter((e) => inMonth(e.date)), (e) => e.vat);

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const unpaidTotal = sum(unpaid, (i) => i.total);

  // Έσοδα ανά μήνα (τρέχον έτος) για γράφημα
  const monthly = Array.from({ length: 12 }, () => ({ revenue: 0, expenses: 0 }));
  for (const i of invoices) {
    const d = new Date(i.date);
    if (d.getFullYear() === y) monthly[d.getMonth()].revenue += Number(i.total || 0);
  }
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d.getFullYear() === y) monthly[d.getMonth()].expenses += Number(e.amount || 0);
  }

  // Εκκρεμείς υπενθυμίσεις (μη ολοκληρωμένες), ταξινομημένες κατά προθεσμία
  const custName = (cid) => (db.customers.find((c) => c.id === cid)?.name || "—");
  const reminders = (db.activities || [])
    .filter((a) => a.type === "reminder" && !a.done)
    .map((a) => ({ ...a, customerName: custName(a.customerId) }))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 6);

  // Εργασίες παραγωγής σε εξέλιξη + καθυστερημένες
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeJobs = (db.jobs || []).filter((j) => (j.status || "active") === "active");
  const overdueJobs = activeJobs.filter((j) => j.dueDate && j.dueDate < todayStr).length;

  const products = db.products || [];
  const lowStock = products.filter(
    (p) => p.trackStock !== false && Number(p.stock) <= Number(p.lowStock || 0)
  );

  // Κορυφαία προϊόντα (βάσει τεμαχίων που πωλήθηκαν)
  const soldMap = {};
  for (const inv of invoices) {
    for (const it of inv.items || []) {
      const key = it.productId || it.description;
      if (!soldMap[key]) soldMap[key] = { name: it.description, qty: 0, revenue: 0 };
      soldMap[key].qty += Number(it.quantity || 0);
      soldMap[key].revenue +=
        Number(it.quantity || 0) * Number(it.unitPrice || 0) * (1 - Number(it.discount || 0) / 100);
    }
  }
  const topProducts = Object.values(soldMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return NextResponse.json({
    year: y,
    monthRevenue,
    yearRevenue,
    monthRevenueNet,
    monthVatCollected,
    monthExpenses,
    yearExpenses,
    monthVatPaid,
    monthProfit: monthRevenueNet - sum(expenses.filter((e) => inMonth(e.date)), (e) => e.net || e.amount),
    vatBalance: monthVatCollected - monthVatPaid,
    counts: {
      invoices: invoices.length,
      customers: (db.customers || []).length,
      products: products.length,
    },
    unpaidCount: unpaid.length,
    unpaidTotal,
    monthly,
    lowStock,
    topProducts,
    reminders,
    activeJobs: activeJobs.length,
    overdueJobs,
    recentInvoices: invoices.slice(0, 6),
  });
}
