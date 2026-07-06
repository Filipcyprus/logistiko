import { NextResponse } from "next/server";
import { listDocs, createDoc } from "@/lib/docs";

export async function GET() {
  return NextResponse.json(listDocs("quotes"));
}

export async function POST(request) {
  const body = await request.json();
  const res = createDoc("quotes", body);
  if (res.error) return NextResponse.json(res, { status: 400 });
  return NextResponse.json(res, { status: 201 });
}
