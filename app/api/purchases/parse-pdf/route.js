import { NextResponse } from "next/server";
import { extractInvoiceItems } from "@/lib/pdfInvoiceParser";

export const dynamic = "force-dynamic";

// Εξαγωγή γραμμών από PDF τιμολόγιο προμηθευτή, για προσυμπλήρωση νέας παραγγελίας (PO).
// Best-effort εξαγωγή — ο χρήστης ελέγχει/διορθώνει πριν αποθηκεύσει.
export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "errors.badRequest" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const { items, source } = await extractInvoiceItems(buffer);
    return NextResponse.json({ items, source });
  } catch (e) {
    console.error("Σφάλμα ανάλυσης PDF:", e);
    return NextResponse.json({ error: "errors.pdfParseFailed" }, { status: 400 });
  }
}
