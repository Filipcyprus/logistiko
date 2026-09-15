import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { buildLedgerEntries, aggregateByAccount, round2 } from "@/lib/ledger";

// Ισοζύγιο (Trial Balance) — αθροιστικά υπόλοιπα ανά λογαριασμό, από την αρχή μέχρι μια
// ημερομηνία ("έως"). Χρησιμοποιεί την ΙΔΙΑ λίστα άρθρων με το /api/journal (βλ. lib/ledger.js),
// οπότε το άθροισμα Χρέωσης πάντα ισούται με το άθροισμα Πίστωσης — είναι μαθηματική συνέπεια του
// ότι κάθε μεμονωμένο άρθρο εκεί ήδη ισορροπεί, όχι κάτι που ελέγχεται/διορθώνεται εδώ.
//
// Το Απόθεμα (inventory) εδώ είναι το ΛΟΓΙΣΤΙΚΟ υπόλοιπο (αγορές μείον κόστος πωληθέντων, από τις
// πραγματικές κινήσεις) — γι' αυτό εμφανίζεται ξεχωριστά και η τρέχουσα ΦΥΣΙΚΗ αξία αποθέματος
// (stock × κόστος, ΤΩΡΑ), ώστε να φαίνεται αν ταιριάζουν. Μπορεί να μη συμφωνούν για παλιότερες
// πωλήσεις/αγορές που έγιναν πριν υπάρξει αυτή η παρακολούθηση, ή αν το κόστος ενός προϊόντος
// άλλαξε από τότε που πουλήθηκε/αγοράστηκε (χρησιμοποιείται πάντα το ΤΡΕΧΟΝ κόστος).
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
  const cogs = get("cogs");
  const expensesNet = get("expensesNet");
  const expensesVat = get("vatInput");
  const salesNet = -get("sales"); // sales is naturally a credit balance (negative here) — flip for display
  const salesVat = -get("vatOutput");

  const debitTotal = round2(cash + bank + receivable + inventory + cogs + expensesNet + expensesVat);
  const creditTotal = round2(salesNet + salesVat);

  const physicalInventoryValue = round2(
    (db.products || []).reduce((a, p) => a + Number(p.stock || 0) * Number(p.cost || 0), 0)
  );

  return NextResponse.json({
    to,
    cash, bank, receivable, inventory, cogs, expensesNet, expensesVat,
    salesNet, salesVat,
    debitTotal, creditTotal,
    physicalInventoryValue,
    inventoryVariance: round2(physicalInventoryValue - inventory),
  });
}
