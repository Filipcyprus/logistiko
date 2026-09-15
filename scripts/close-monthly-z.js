#!/usr/bin/env node
// Κλείνει αυτόματα τη Ζ Αναφορά του τρέχοντος μήνα — ΜΟΝΟ αν σήμερα είναι η τελευταία ημέρα του
// μήνα. Σχεδιασμένο να τρέχει ΚΑΘΕ ΜΕΡΑ μέσω cron (π.χ. στις 23:50) — ελέγχει μόνο του αν είναι
// η κατάλληλη μέρα, οπότε είναι ασφαλές να τρέχει καθημερινά χωρίς να χρειάζεται να υπολογίσει
// κανείς ποια μέρα είναι η 28η/29η/30η/31η κάθε μήνα (crontab δεν το υποστηρίζει απευθείας).
//
// Χρήση:  node scripts/close-monthly-z.js
// Cron:   50 23 * * * cd /var/www/logistiko && /usr/bin/node scripts/close-monthly-z.js >> /var/log/logistiko-z.log 2>&1
//
// Τρέχει ΑΠΕΥΘΕΙΑΣ πάνω στο data/db.json (χωρίς να περνάει από το API / session cookie — δεν έχει
// νόημα έλεγχος ρόλου εδώ, τρέχει ως root στον ίδιο τον server) — ίδια λογική με το
// app/api/z-report/route.js (computeZData + POST), κρατημένη σε συγχρονισμό χειροκίνητα.
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");

function isLastDayOfMonth(d) {
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  return tomorrow.getMonth() !== d.getMonth();
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function computeMonthZ(db, period) {
  const receipts = (db.invoices || [])
    .filter((i) => i.type === "apodeixi" && !(i.isPaymentReceipt && i.relatedInvoiceId) && String(i.date).slice(0, 7) === period)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const sum = (arr, f) => round2(arr.reduce((a, x) => a + Number(f(x) || 0), 0));

  const byVatMap = {};
  for (const r of receipts) {
    for (const it of r.items || []) {
      const rate = Number(it.vatRate || 0);
      const net = Number(it.quantity) * Number(it.unitPrice) * (1 - Number(it.discount || 0) / 100);
      const vat = net * (rate / 100);
      if (!byVatMap[rate]) byVatMap[rate] = { rate, net: 0, vat: 0 };
      byVatMap[rate].net += net;
      byVatMap[rate].vat += vat;
    }
  }
  const byVatRate = Object.values(byVatMap)
    .map((x) => ({ rate: x.rate, net: round2(x.net), vat: round2(x.vat), gross: round2(x.net + x.vat) }))
    .sort((a, b) => b.rate - a.rate);

  const byMethodMap = {};
  for (const r of receipts) {
    const key = r.paymentMethod || "cash";
    if (!byMethodMap[key]) byMethodMap[key] = { method: key, count: 0, total: 0 };
    byMethodMap[key].count++;
    byMethodMap[key].total += Number(r.total || 0);
  }
  const byPaymentMethod = Object.values(byMethodMap)
    .map((x) => ({ ...x, total: round2(x.total) }))
    .sort((a, b) => b.total - a.total);

  const byDayMap = {};
  for (const r of receipts) {
    if (!byDayMap[r.date]) byDayMap[r.date] = { date: r.date, count: 0, net: 0, vat: 0, total: 0 };
    byDayMap[r.date].count++;
    byDayMap[r.date].net += Number(r.net || 0);
    byDayMap[r.date].vat += Number(r.vat || 0);
    byDayMap[r.date].total += Number(r.total || 0);
  }
  const byDay = Object.values(byDayMap)
    .map((x) => ({ ...x, net: round2(x.net), vat: round2(x.vat), total: round2(x.total) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    mode: "month", period,
    count: receipts.length,
    net: sum(receipts, (r) => r.net),
    vat: sum(receipts, (r) => r.vat),
    total: sum(receipts, (r) => r.total),
    byVatRate, byPaymentMethod, byDay,
  };
}

function main() {
  const now = new Date();
  if (!isLastDayOfMonth(now)) {
    console.log(`[${now.toISOString()}] Δεν είναι η τελευταία μέρα του μήνα — καμία ενέργεια.`);
    return;
  }

  const period = now.toISOString().slice(0, 7);
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  db.zReports = db.zReports || [];
  db.counters = db.counters || {};

  if (db.zReports.some((z) => z.mode === "month" && z.period === period)) {
    console.log(`[${now.toISOString()}] Η Ζ για τον μήνα ${period} έχει ήδη κλείσει — παράλειψη.`);
    return;
  }

  const data = computeMonthZ(db, period);
  const seq = db.counters.zReport || 1;
  const number = `${(db.settings && db.settings.zReportPrefix) || "Z-"}${String(seq).padStart(5, "0")}`;

  const record = {
    id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase(),
    number, ...data,
    closedAt: new Date().toISOString(),
    closedBy: null,
    auto: true,
    printed: false,
  };

  fs.copyFileSync(DB_FILE, DB_FILE + ".before-auto-z-" + period);
  db.zReports.unshift(record);
  db.counters.zReport = seq + 1;
  fs.writeFileSync(DB_FILE + ".tmp", JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(DB_FILE + ".tmp", DB_FILE);

  console.log(`[${now.toISOString()}] Έκλεισε αυτόματα η Ζ ${number} για τον μήνα ${period} (σύνολο ${record.total}).`);
}

main();
