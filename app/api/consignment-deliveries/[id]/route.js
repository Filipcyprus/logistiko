import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET(request, { params }) {
  const db = readDB();
  const delivery = (db.consignmentDeliveries || []).find((d) => d.id === params.id);
  if (!delivery) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

  const store = (db.consignmentStores || []).find((s) => s.id === delivery.storeId) || null;

  return NextResponse.json({
    delivery,
    store,
    company: {
      companyName: db.settings.companyName,
      logo: db.settings.logo,
      address: db.settings.address,
      city: db.settings.city,
      postalCode: db.settings.postalCode,
      afm: db.settings.afm,
      phone: db.settings.phone,
    },
  });
}
