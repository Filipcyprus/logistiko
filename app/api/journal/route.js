import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { buildLedgerEntries } from "@/lib/ledger";
import { accountNumber } from "@/lib/accounts";

// Ημερολόγιο Κινήσεων (General Journal) — βλ. lib/ledger.js για την πλήρη λογική διπλής εγγραφής
// (κοινή με το /api/trial-balance, ώστε τα δύο ποτέ να μην αποκλίνουν).
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || 50)));

  const entries = buildLedgerEntries(db, from, to).map((e) => ({
    ...e,
    lines: e.lines.map((l) => ({ ...l, accountNumber: accountNumber(l.account) })),
  }));

  const total = entries.length;
  const start = (page - 1) * pageSize;
  const pageItems = entries.slice(start, start + pageSize);

  return NextResponse.json({ entries: pageItems, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
}
