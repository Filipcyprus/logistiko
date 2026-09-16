import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Ημερολόγιο Κινήσεων — η λίστα των καταχωρισμένων άρθρων του Γενικού Καθολικού, πιο πρόσφατα
// πρώτα. Κάθε γραμμή συνοδεύεται από αριθμό/ονομασία λογαριασμού, ώστε να διαβάζεται αυτούσια.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || 50)));

  const accountById = new Map((db.accounts || []).map((a) => [a.id, a]));

  let entries = (db.journalEntries || []).filter((e) => e.date >= from && e.date <= to);

  if (q) {
    entries = entries.filter((e) => {
      const haystack = [
        e.number,
        e.memo,
        e.memoParams ? Object.values(e.memoParams).join(" ") : "",
        ...(e.lines || []).map((l) => {
          const a = accountById.get(l.accountId);
          return `${a?.number || ""} ${a?.name || ""} ${l.itemLabel || ""}`;
        }),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));

  const total = entries.length;
  const start = (page - 1) * pageSize;
  const pageItems = entries.slice(start, start + pageSize).map((e) => ({
    ...e,
    lines: (e.lines || []).map((l) => {
      const a = accountById.get(l.accountId);
      return {
        ...l,
        accountNumber: a?.number || "",
        accountName: a?.name || "",
        accountNameKey: a?.nameKey || null,
      };
    }),
  }));

  return NextResponse.json({
    entries: pageItems, total, page, pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}
