import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { buildLedgerEntries, aggregateByAccount, round2 } from "@/lib/ledger";

// Κατάσταση Αποτελεσμάτων (Profit & Loss / Income Statement) — ΓΙΑ ΠΕΡΙΟΔΟ (from/to), σε αντίθεση
// με το Ισοζύγιο που είναι αθροιστικό "έως" μια ημερομηνία. Ίδια δεδομένα με το Ημερολόγιο
// (lib/ledger.js), απλώς παρουσιασμένα στην κλασική μορφή:
//   Πωλήσεις (καθαρές)
//   − Κόστος Πωληθέντων           = Μικτό Κέρδος
//   − Λειτουργικά Έξοδα           = Καθαρό Κέρδος
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";

  const entries = buildLedgerEntries(db, from, to);
  const acct = aggregateByAccount(entries);
  const get = (key) => (acct[key] ? acct[key].balance : 0);

  const salesNet = round2(-get("sales"));
  const cogs = round2(get("cogs"));
  const grossProfit = round2(salesNet - cogs);
  const expensesNet = round2(get("expensesNet"));
  const netIncome = round2(grossProfit - expensesNet);

  return NextResponse.json({ from, to, salesNet, cogs, grossProfit, expensesNet, netIncome });
}
