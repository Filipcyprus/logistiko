import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { buildLedgerEntries, aggregateByAccount, round2 } from "@/lib/ledger";

// Ισολογισμός (Balance Sheet) — "έως" μια ημερομηνία, αθροιστικά από την αρχή (όπως το Ισοζύγιο).
//   Ενεργητικό (Assets)     = Ταμείο + Τράπεζα + Πελάτες + Απόθεμα
//   Υποχρεώσεις (Liabilities) = Προμηθευτές + ΦΠΑ προς απόδοση (καθαρό, αν είναι θετικό — αλλιώς
//                                αρνητική υποχρέωση, δηλαδή ουσιαστικά απαίτηση προς επιστροφή)
//   Ίδια Κεφάλαια (Equity)  = Συσσωρευμένα κέρδη = Πωλήσεις − Κόστος Πωληθέντων − Έξοδα (από την
//                              αρχή μέχρι "έως")
// Ενεργητικό ΠΑΝΤΑ ισούται με Υποχρεώσεις + Ίδια Κεφάλαια — μαθηματική συνέπεια του ότι κάθε
// άρθρο στο lib/ledger.js ήδη ισορροπεί (δεν ελέγχεται/διορθώνεται εδώ).
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const entries = buildLedgerEntries(db, "0000-01-01", to);
  const acct = aggregateByAccount(entries);
  const get = (key) => (acct[key] ? acct[key].balance : 0);

  const cash = get("cash");
  const bank = get("bank");
  const receivable = get("receivable");
  const inventory = get("inventory");
  const totalAssets = round2(cash + bank + receivable + inventory);

  const payable = round2(-get("payable"));
  const vatNet = round2(-get("vatOutput") - get("vatInput")); // θετικό = οφείλεται, αρνητικό = προς επιστροφή
  const totalLiabilities = round2(payable + vatNet);

  const salesNet = round2(-get("sales"));
  const cogs = round2(get("cogs"));
  const expensesNet = round2(get("expensesNet"));
  const retainedEarnings = round2(salesNet - cogs - expensesNet);

  const totalLiabilitiesAndEquity = round2(totalLiabilities + retainedEarnings);

  return NextResponse.json({
    to,
    cash, bank, receivable, inventory, totalAssets,
    payable, vatNet, totalLiabilities,
    retainedEarnings, totalLiabilitiesAndEquity,
  });
}
