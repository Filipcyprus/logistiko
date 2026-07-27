import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Σύνοψη βαρδιών ανά ταμία: πωλήσεις (μέσω shiftId), έξοδα της ίδιας ημέρας, κέρδος.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";

  const shifts = (db.shifts || []).filter((s) => {
    const d = (s.openedAt || "").slice(0, 10);
    return d >= from && d <= to;
  });

  const summary = shifts
    .map((s) => {
      const date = (s.openedAt || "").slice(0, 10);
      const sales = (db.invoices || [])
        .filter((inv) => inv.shiftId === s.id)
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      const expenses = (db.expenses || [])
        .filter((e) => e.date === date)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      return {
        id: s.id,
        date,
        cashier: s.openedBy || "",
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        sales: Math.round(sales * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        profit: Math.round((sales - expenses) * 100) / 100,
      };
    })
    .sort((a, b) => (b.openedAt || "").localeCompare(a.openedAt || ""));

  return NextResponse.json(summary);
}
