import { NextResponse } from "next/server";
import { readDB, update } from "@/lib/db";

// Επιστρέφει όλες τις κινήσεις "τραπεζικό έμβασμα" (τιμολόγια + πληρωμές πελατών) σε ένα
// εύρος ημερομηνιών, ώστε να συγκριθούν χειροκίνητα με το αντίγραφο κίνησης της τράπεζας.
export async function GET(request) {
  const db = readDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "0000-01-01";
  const to = searchParams.get("to") || "9999-12-31";
  const inRange = (d) => d >= from && d <= to;

  const invoices = (db.invoices || [])
    .filter((i) => i.paymentMethod === "bank" && inRange(i.date))
    .map((i) => ({
      type: "invoice", id: i.id, date: i.date, amount: Number(i.total || 0),
      label: i.customer?.name || "", ref: i.number,
      reconciled: !!i.reconciled, reconciledAt: i.reconciledAt || null,
    }));

  const payments = (db.payments || [])
    .filter((p) => p.method === "bank" && inRange(p.date))
    .map((p) => {
      const customer = (db.customers || []).find((c) => c.id === p.customerId);
      return {
        type: "payment", id: p.id, date: p.date, amount: Number(p.amount || 0),
        label: customer?.name || "", ref: p.receiptNumber || "",
        reconciled: !!p.reconciled, reconciledAt: p.reconciledAt || null,
      };
    });

  const entries = [...invoices, ...payments].sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json(entries);
}

// Σημείωση/αναίρεση συμφωνίας μιας κίνησης με την κατάθεση της τράπεζας.
export async function PUT(request) {
  const body = await request.json();
  const { type, id, reconciled } = body;
  if (type !== "invoice" && type !== "payment") {
    return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });
  }
  const collection = type === "invoice" ? "invoices" : "payments";
  const rec = update(collection, id, {
    reconciled: !!reconciled,
    reconciledAt: reconciled ? new Date().toISOString() : null,
  });
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}
