import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { buildLedgerEntries, round2 } from "@/lib/ledger";
import { ACCOUNTS } from "@/lib/accounts";

// Καθολικό (General Ledger) ανά λογαριασμό — κάθε κίνηση που έχει επηρεάσει τον επιλεγμένο
// λογαριασμό, με τρέχον υπόλοιπο (running balance), ξεκινώντας από ένα "αρχικό υπόλοιπο" (opening
// balance) = το άθροισμα όλων των προγενέστερων κινήσεων πριν το "from". Ίδια δεδομένα με το
// Ημερολόγιο (lib/ledger.js), απλώς φιλτραρισμένα σε ΕΝΑΝ λογαριασμό και σε αύξουσα χρονολογική
// σειρά (χρειάζεται για το running balance — το Ημερολόγιο δείχνει τα πιο πρόσφατα πρώτα).
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const account = searchParams.get("account");
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  if (!account || !ACCOUNTS[account]) return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });

  const allEntries = buildLedgerEntries(db, "0000-01-01", "9999-12-31");

  let openingBalance = 0;
  const lines = [];
  for (const e of allEntries) {
    const accLines = e.lines.filter((l) => l.account === account);
    if (accLines.length === 0) continue;
    const debit = round2(accLines.reduce((a, l) => a + (l.debit || 0), 0));
    const credit = round2(accLines.reduce((a, l) => a + (l.credit || 0), 0));
    if (e.date < from) {
      openingBalance += debit - credit;
      continue;
    }
    if (e.date > to) continue;
    lines.push({ date: e.date, createdAt: e.createdAt, ref: e.ref, descKey: e.descKey, descParams: e.descParams, debit, credit });
  }
  openingBalance = round2(openingBalance);

  // Ταξινόμηση με πλήρη χρονική σφραγίδα (όχι μόνο ημερομηνία) — δύο κινήσεις την ΙΔΙΑ μέρα πρέπει
  // να εμφανίζονται με τη σειρά που πραγματικά έγιναν, αλλιώς το τρέχον υπόλοιπο "χτίζεται" ανάποδα.
  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
  let running = openingBalance;
  for (const l of lines) {
    running = round2(running + l.debit - l.credit);
    l.balance = running;
  }

  return NextResponse.json({ account, accountNumber: ACCOUNTS[account], from, to, openingBalance, lines, closingBalance: running });
}
