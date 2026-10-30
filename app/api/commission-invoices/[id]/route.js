import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export const dynamic = "force-dynamic";

// Τιμολόγιο προμήθειας από εμάς προς ένα κατάστημα παρακαταθήκης (το ποσό που του δίνουμε). Δεν είναι πώληση: το
// ποσό καταχωρείται ως έξοδο/υποχρέωση προς το κατάστημα (βλ. registerConsignmentSales), και εδώ φαίνεται αν έχει πληρωθεί.
export async function GET(_req, { params }) {
  const db = readDB();
  const doc = (db.commissionInvoices || []).find((x) => x.id === params.id);
  if (!doc) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const store = (db.consignmentStores || []).find((s) => s.id === doc.storeId) || null;
  const expense = (db.expenses || []).find((e) => e.id === doc.expenseId) || null;

  return NextResponse.json({
    doc: { ...doc, paid: !!expense?.paid },
    store,
    company: {
      companyName: db.settings.companyName,
      logo: db.settings.logo,
      address: db.settings.address,
      city: db.settings.city,
      postalCode: db.settings.postalCode,
      afm: db.settings.afm,
      phone: db.settings.phone,
      email: db.settings.email,
      currency: db.settings.currency || "€",
    },
  });
}
