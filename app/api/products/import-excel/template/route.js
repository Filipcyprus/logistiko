import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Δείγμα αρχείου με τις αναμενόμενες στήλες, ώστε ο χρήστης να ξέρει ακριβώς τι να συμπληρώσει.
export async function GET() {
  const sample = [
    { Name: "A4 Paper 80gsm", Barcode: "", SKU: "", Stock: 100, Price: 4.5, Unit: "reams", VAT: 19, Category: "Paper", Brand: "" },
    { Name: "Existing Product Example", Barcode: "1234567890123", SKU: "", Stock: 25, Price: "", Unit: "", VAT: "", Category: "", Brand: "" },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sample);
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="product-import-template.xlsx"',
    },
  });
}
