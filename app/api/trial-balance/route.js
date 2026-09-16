import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { trialBalance } from "@/lib/reports";
import { round2 } from "@/lib/posting";

// Ισοζύγιο — διαβάζει ΜΟΝΟ από το Γενικό Καθολικό (βλ. lib/reports.js).
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const tb = trialBalance(db, asOf);

  // Σύγκριση λογιστικού vs φυσικού αποθέματος — χρήσιμη ένδειξη, εκτός ισοζυγίου.
  const physicalInventoryValue = round2(
    (db.products || []).reduce((a, p) => a + Number(p.stock || 0) * Number(p.cost || 0), 0)
  );
  const inventoryAccount = (db.accounts || []).find((a) => a.systemKey === "inventory");
  const ledgerInventory = inventoryAccount
    ? round2((tb.lines.find((l) => l.id === inventoryAccount.id)?.balance) || 0)
    : 0;

  return NextResponse.json({
    ...tb,
    physicalInventoryValue,
    ledgerInventory,
    inventoryVariance: round2(physicalInventoryValue - ledgerInventory),
  });
}
