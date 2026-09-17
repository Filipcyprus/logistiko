import { NextResponse } from "next/server";
import { list, readDB, writeDB, uid } from "@/lib/db";
import { postEntry } from "@/lib/posting";
import { entryForExpense } from "@/lib/postingRules";

export async function GET() {
  return NextResponse.json(list("expenses"));
}

// Κάθε έξοδο παίρνει έναν μοναδικό, συνεχόμενο αριθμό (π.χ. EXP-00001) — ίδια λογική με τους
// αριθμούς παραστατικών, ώστε να εντοπίζεται εύκολα (π.χ. στο Ημερολόγιο Κινήσεων).
export async function POST(request) {
  const body = await request.json();
  if (!body.description || !body.description.trim()) {
    return NextResponse.json({ error: "errors.descriptionRequired" }, { status: 400 });
  }
  const db = readDB();
  const seq = db.counters.expense || 1;
  const number = `${db.settings.expensePrefix || "EXP-"}${String(seq).padStart(5, "0")}`;
  const rec = {
    id: uid(),
    number,
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || "general",
    description: body.description.trim(),
    supplier: body.supplier || "",
    // Σύνδεση με καρτέλα προμηθευτή όταν το όνομα ταιριάζει — χρειάζεται για να μπορεί να
    // εξοφληθεί αργότερα ένα απλήρωτο τιμολόγιο (βλ. /api/supplier-payments).
    supplierId: body.supplierId || null,
    net: Number(body.net || 0),
    vat: Number(body.vat || 0),
    amount: Number(body.amount || 0),
    // "credit" = ήρθε το τιμολόγιο αλλά δεν πληρώθηκε ακόμα.
    paymentMethod: body.paymentMethod || "cash",
    paidAmount: body.paymentMethod === "credit" ? 0 : Number(body.amount || 0),
    paid: body.paymentMethod !== "credit",
    // Προαιρετικός συγκεκριμένος λογαριασμός εξόδου (π.χ. 5200 Ενοίκια) — αλλιώς γενικά έξοδα.
    accountId: body.accountId || null,
    // Σύνδεσμος προς το ανεβασμένο παραστατικό ({ url, name, type, size }) — το ίδιο το αρχείο
    // ζει στον δίσκο, βλ. /api/uploads.
    attachment: body.attachment || null,
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
  };
  db.expenses = [rec, ...(db.expenses || [])];
  db.counters.expense = seq + 1;

  try {
    const entryInput = entryForExpense(db, rec);
    if (entryInput) postEntry(db, { ...entryInput, source: { type: "expense", id: rec.id } });
  } catch (e) {
    if (e.code === "PERIOD_LOCKED") return NextResponse.json({ error: "errors.periodLocked" }, { status: 400 });
    throw e;
  }

  writeDB(db);
  return NextResponse.json(rec, { status: 201 });
}
