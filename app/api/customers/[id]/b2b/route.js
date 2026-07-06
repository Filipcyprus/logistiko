import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

function makeToken() {
  return (
    Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)
  );
}
function makePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Ενεργοποίηση / ανανέωση B2B πρόσβασης
export async function POST(_req, { params }) {
  const db = readDB();
  const c = db.customers.find((x) => x.id === params.id);
  if (!c) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  c.b2bEnabled = true;
  if (!c.b2bToken) c.b2bToken = makeToken();
  if (!c.b2bPin) c.b2bPin = makePin();
  if (c.requirePin === undefined) c.requirePin = true;
  writeDB(db);
  return NextResponse.json({ b2bEnabled: true, b2bToken: c.b2bToken, b2bPin: c.b2bPin, requirePin: c.requirePin });
}

// Νέο PIN / νέος σύνδεσμος
export async function PUT(_req, { params }) {
  const db = readDB();
  const c = db.customers.find((x) => x.id === params.id);
  if (!c) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  c.b2bToken = makeToken();
  c.b2bPin = makePin();
  c.b2bEnabled = true;
  writeDB(db);
  return NextResponse.json({ b2bEnabled: true, b2bToken: c.b2bToken, b2bPin: c.b2bPin });
}

// Απενεργοποίηση
export async function DELETE(_req, { params }) {
  const db = readDB();
  const c = db.customers.find((x) => x.id === params.id);
  if (!c) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  c.b2bEnabled = false;
  writeDB(db);
  return NextResponse.json({ b2bEnabled: false });
}

// Εναλλαγή απαίτησης PIN
export async function PATCH(req, { params }) {
  const db = readDB();
  const c = db.customers.find((x) => x.id === params.id);
  if (!c) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });
  const { requirePin } = await req.json();
  c.requirePin = Boolean(requirePin);
  writeDB(db);
  return NextResponse.json({ requirePin: c.requirePin });
}
