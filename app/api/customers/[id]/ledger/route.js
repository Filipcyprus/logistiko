import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

// Καρτέλα πελάτη: χρεώσεις (παραστατικά) & πιστώσεις (εισπράξεις) με τρέχον υπόλοιπο.
export async function GET(_req, { params }) {
  const db = readDB();
  const customer = db.customers.find((x) => x.id === params.id);
  if (!customer) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const invoices = db.invoices.filter((i) => i.customerId === params.id);
  const payments = db.payments.filter((p) => p.customerId === params.id);
  const quotes = db.quotes.filter((q) => q.customerId === params.id);
  const orders = db.orders.filter((o) => o.customerId === params.id);

  // Το ref/desc μεταφράζονται στο client (kind/invoiceKind/method περνιούνται ως δεδομένα, όχι έτοιμο κείμενο).
  const entries = [
    ...invoices.map((i) => ({
      kind: "invoice", id: i.id, date: i.date, ref: i.number,
      invoiceKind: i.type,
      debit: Number(i.total), credit: 0,
    })),
    ...payments.map((p) => ({
      kind: "payment", id: p.id, date: p.date, ref: null,
      method: p.method, notes: p.notes,
      debit: 0, credit: Number(p.amount),
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.kind === "invoice" ? -1 : 1));

  let running = 0;
  for (const e of entries) {
    running = Math.round((running + e.debit - e.credit) * 100) / 100;
    e.balance = running;
  }

  const totalCharged = invoices.reduce((a, x) => a + Number(x.total), 0);
  const totalPaid = payments.reduce((a, x) => a + Number(x.amount), 0);

  // Ημέρες χρέωσης = παλαιότερο ανεξόφλητο παραστατικό που εκκρεμεί.
  const now = new Date();
  const daysSince = (d) => Math.max(0, Math.floor((now - new Date(d)) / 86400000));
  const unpaidInvoices = invoices.filter((i) => i.status === "unpaid");
  const debitDays = unpaidInvoices.length
    ? Math.max(...unpaidInvoices.map((i) => daysSince(i.date)))
    : 0;

  return NextResponse.json({
    customer,
    entries: entries.reverse(), // πιο πρόσφατα πρώτα
    balance: Math.round((totalCharged - totalPaid) * 100) / 100,
    totalCharged: Math.round(totalCharged * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    grossIncome: Math.round(totalCharged * 100) / 100,
    debitDays,
    creditDays: Number(customer.creditDays || 0),
    counts: { invoices: invoices.length, quotes: quotes.length, orders: orders.length },
    invoices,
    quotes,
    orders,
  });
}
