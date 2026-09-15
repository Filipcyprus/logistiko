// Λογιστικό Σχέδιο (Chart of Accounts) — σταθεροί, μοναδικοί αριθμοί λογαριασμού για κάθε
// "κλειδί" λογαριασμού που ήδη χρησιμοποιούν το /api/journal και το /api/trial-balance. Ο αριθμός
// ΠΟΤΕ δεν αλλάζει μόλις δοθεί — αν προστεθεί νέος λογαριασμός, δίνεται νέος αριθμός, δεν
// ξαναχρησιμοποιούνται ούτε ξαναταξινομούνται οι υπάρχοντες.
export const ACCOUNTS = {
  cash: "1000", // Ταμείο (Cash in hand)
  bank: "1010", // Τράπεζα (Bank account)
  receivable: "1100", // Πελάτες (Accounts Receivable)
  inventory: "1200", // Απόθεμα (Inventory)
  vatOutput: "2100", // ΦΠΑ Εκροών (VAT Output — payable)
  vatInput: "2110", // ΦΠΑ Εισροών (VAT Input — receivable)
  sales: "4000", // Πωλήσεις (Sales)
  cogs: "5000", // Κόστος Πωληθέντων (Cost of Goods Sold)
  expensesNet: "5100", // Λειτουργικά Έξοδα (Operating Expenses)
};

export function accountNumber(key) {
  return ACCOUNTS[key] || "";
}
