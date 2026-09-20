// Τομείς πελατών: Barber / Print Shop / Perfumes. Η τιμή που αποθηκεύεται στον πελάτη (customer.profession)
// είναι ΙΔΙΑ με τις ετικέτες "Target professions" των προϊόντων ("Barber", "Print", "Perfumes") — έτσι το B2B
// link φιλτράρει τον κατάλογο και οι ανακοινώσεις πάνε στον σωστό τομέα με την ίδια τιμή.
// Οι τιμές ΔΕΝ αλλάζουν ποτέ εδώ· αλλάζει μόνο η ετικέτα που βλέπει ο χρήστης (π.χ. "Print" → "Print Shop").
export const DOMAINS = [
  { value: "Barber", key: "domains.barber" },
  { value: "Print", key: "domains.print" },
  { value: "Perfumes", key: "domains.perfumes" },
];

const VALUES = DOMAINS.map((d) => d.value);

export const isKnownDomain = (value) => VALUES.includes(value);

// Ομάδα ενός πελάτη για φίλτρα/επιλογές: ένας από τους τρεις τομείς, αλλιώς "other" (κενό ή παλιά τιμή
// όπως "Mechanic").
export const domainGroup = (customer) => (isKnownDomain(customer?.profession) ? customer.profession : "other");

// Επιλογές για <select>: οι τρεις τομείς, ΚΑΙ η τρέχουσα τιμή του πελάτη αν είναι κάτι άλλο (π.χ. "Mechanic")
// — αλλιώς η λίστα θα έδειχνε άλλη τιμή από αυτή που έχει αποθηκευμένη και ένα Save θα την άλλαζε αθόρυβα.
export function domainSelectOptions(current) {
  const extra = current && !isKnownDomain(current) ? [{ value: current, key: null, label: current }] : [];
  return [...DOMAINS, ...extra];
}
