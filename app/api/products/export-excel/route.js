import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { readDB } from "@/lib/db";

// Εξαγωγή ΟΛΟΚΛΗΡΟΥ του καταλόγου προϊόντων σε Excel — για μαζική επεξεργασία (τίτλος, SKU,
// barcode, τιμές, απόθεμα) σε Excel/Numbers/Sheets και επανεισαγωγή μέσω import-excel.
// Η στήλη ID είναι ο μοναδικός αξιόπιστος τρόπος να ταιριάξει η επανεισαγωγή με το ΣΩΣΤΟ προϊόν
// όταν αλλάζουν ακριβώς τα πεδία (όνομα/SKU/barcode) που θα χρησιμοποιούνταν αλλιώς για ταίριασμα —
// γι' αυτό ΔΕΝ πρέπει να διαγραφεί/αλλαχτεί η στήλη ID σε γραμμές υπαρχόντων προϊόντων.
export async function GET() {
  const db = readDB();

  const rows = db.products.map((p) => ({
    ID: p.id,
    Name: p.name,
    SKU: p.sku || "",
    Barcode: p.barcode || "",
    "Wholesale Price": p.wholesalePrice ?? p.price ?? 0,
    "Retail Price": p.retailPrice ?? "",
    Stock: p.stock ?? 0,
    Cost: p.cost ?? "",
    VAT: p.saleVatRate ?? p.vatRate ?? "",
    Category: p.category || "",
    Brand: p.brand || "",
    Unit: p.unit || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `stock-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
