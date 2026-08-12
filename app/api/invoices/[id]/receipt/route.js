import { NextResponse } from "next/server";
import { readDB, writeDB, uid } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

// Έκδοση απόδειξης πληρωμής για παραστατικό που καταχωρήθηκε ήδη ως εξοφλημένο κατά
// τη δημιουργία του (π.χ. τιμολόγιο με μετρητά επί τόπου) — χωρίς ξεχωριστή κίνηση
// "πληρωμής" στο /api/payments, αφού δεν άλλαξε ποτέ η κατάσταση εξόφλησης του.
export async function POST(_req, { params }) {
  const db = readDB();
  const inv = db.invoices.find((x) => x.id === params.id);
  if (!inv) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  if (inv.type === "credit" || inv.isPaymentReceipt) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }
  if (inv.status !== "paid") {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }
  if ((inv.paymentReceipts || []).length > 0) {
    return NextResponse.json({ error: "errors.invalidData" }, { status: 400 });
  }

  // Η απόδειξη πληρωμής παίρνει τον ΙΔΙΟ αριθμό (aa) με το τιμολόγιο που αφορά, όχι τον επόμενο
  // διαθέσιμο από τον ανεξάρτητο μετρητή αποδείξεων — έτσι είναι άμεσα αναγνωρίσιμο ποια απόδειξη
  // πάει με ποιο τιμολόγιο. Ασφαλιστική δικλείδα: αν αυτός ο αριθμός χρησιμοποιείται ήδη από άλλο
  // παραστατικό (π.χ. παλιά απόδειξη λιανικής), αρνήσου αντί να δημιουργήσεις διπλότυπο αριθμό.
  const series = inv.series || db.settings.series || "A";
  const prefix = db.settings.receiptPrefix || "RCT-";
  const seq = Number(inv.aa);
  const number = `${prefix}${series}-${String(seq).padStart(5, "0")}`;
  if (db.invoices.some((x) => x.number === number)) {
    return NextResponse.json({ error: "errors.receiptNumberTaken" }, { status: 409 });
  }

  const receipt = {
    id: uid(),
    number,
    type: "apodeixi",
    isPaymentReceipt: true,
    series,
    aa: seq,
    date: new Date().toISOString().slice(0, 10),
    customerId: inv.customerId,
    customer: inv.customer,
    relatedInvoiceId: inv.id,
    relatedNumber: inv.number,
    items: [{
      productId: null,
      description: serverT(db.settings.language, "invoices.paymentReceiptLineDesc", { number: inv.number }),
      quantity: 1,
      unit: serverT(db.settings.language, "common.unit"),
      unitPrice: Number(inv.total),
      vatRate: 0,
      discount: 0,
    }],
    net: Number(inv.total),
    vat: 0,
    total: Number(inv.total),
    paymentMethod: inv.paymentMethod,
    status: "paid",
    paidAmount: Number(inv.total),
    notes: "",
    sourceType: "invoice",
    sourceId: inv.id,
    createdAt: new Date().toISOString(),
  };

  db.invoices.unshift(receipt);
  // Μόνο προς τα εμπρός: αν μια ανεξάρτητη απόδειξη λιανικής έχει ήδη προχωρήσει τον μετρητή πιο
  // πέρα από αυτόν τον αριθμό, μην τον γυρίσεις πίσω — θα άνοιγε ξανά το ίδιο κενό αριθμοδότησης.
  db.counters.receipt = Math.max(Number(db.counters.receipt || 1), seq + 1);
  inv.paymentReceipts = [...(inv.paymentReceipts || []), { id: receipt.id, number: receipt.number }];

  writeDB(db);
  return NextResponse.json(receipt, { status: 201 });
}
