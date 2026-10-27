// Μπόνους καταστημάτων παρακαταθήκης: όταν ένα κατάστημα έχει πουλήσει συνολικά τόσα μπουκάλια (από την πρώτη
// παράδοση που του κάναμε), το ποσοστό του ανεβαίνει αυτόματα κατά το έξτρα % του επιπέδου. Κάθε επίπεδο
// ΑΝΤΙΚΑΘΙΣΤΑ το προηγούμενο (δεν αθροίζονται): 30 μπουκάλια → +5%, 60 μπουκάλια → +8% σημαίνει +8% συνολικά στα 60.
// Καθαρές συναρτήσεις — τις χρησιμοποιούν και ο server (καταχώριση πώλησης) και η οθόνη.

export function cleanBonusLevels(levels) {
  return (Array.isArray(levels) ? levels : [])
    .map((l) => ({ bottles: Number(l?.bottles), extraPercent: Number(l?.extraPercent) }))
    .filter((l) => l.bottles > 0 && l.extraPercent > 0)
    .sort((a, b) => a.bottles - b.bottles);
}

// Το υψηλότερο επίπεδο που έχει επιτευχθεί με τόσα μπουκάλια πωλημένα (ή null).
export function bonusFor(levels, soldBottles) {
  let best = null;
  for (const l of cleanBonusLevels(levels)) if (Number(soldBottles) >= l.bottles) best = l;
  return best;
}

// Το επόμενο επίπεδο που δεν έχει επιτευχθεί ακόμα (ή null).
export function nextBonus(levels, soldBottles) {
  return cleanBonusLevels(levels).find((l) => Number(soldBottles) < l.bottles) || null;
}

// Σύνολο μπουκαλιών που έχει πουλήσει ένα κατάστημα, από τις εγγραφές πωλήσεων παρακαταθήκης.
export function soldBottlesOf(consignmentSales, storeId) {
  return (consignmentSales || []).filter((s) => s.storeId === storeId).reduce((a, s) => a + Number(s.quantity || 0), 0);
}
