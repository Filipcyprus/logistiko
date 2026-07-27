import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Μόνο ανάγνωση — συνοπτικά στοιχεία για τον λογιστή (πωλήσεις, έξοδα, αγορές).
// Η πρόσβαση περιορίζεται στο middleware (ρόλος "accountant" ή "owner").
export async function GET() {
  const db = readDB();
  const settings = db.settings || {};

  const invoices = (db.invoices || []).map((i) => ({
    id: i.id,
    number: i.number,
    type: i.type,
    date: i.date,
    customer: i.customer?.name || "",
    net: i.net,
    vat: i.vat,
    total: i.total,
    status: i.status,
  }));

  const purchases = (db.purchases || []).map((p) => ({
    id: p.id,
    number: p.number,
    date: p.date,
    supplier: p.supplier?.name || "",
    net: p.net,
    vat: p.vat,
    total: p.total,
    status: p.status,
    attachment: p.attachment || null,
  }));

  return NextResponse.json({
    settings: {
      companyName: settings.companyName,
      currency: settings.currency,
      vatRate: settings.vatRate,
      afm: settings.afm,
    },
    invoices,
    expenses: db.expenses || [],
    purchases,
  });
}
