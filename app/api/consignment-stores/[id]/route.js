import { NextResponse } from "next/server";
import { update, remove } from "@/lib/db";
import { cleanBonusLevels } from "@/lib/consignmentBonus";

export async function PUT(request, { params }) {
  const patch = await request.json();
  if (patch.bonusLevels !== undefined) patch.bonusLevels = cleanBonusLevels(patch.bonusLevels);
  const rec = update("consignmentStores", params.id, patch);
  if (!rec) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_req, { params }) {
  remove("consignmentStores", params.id);
  return NextResponse.json({ ok: true });
}
