import { useEffect } from "react";

// Οι browsers προτείνουν το document.title ως όνομα αρχείου στο "Αποθήκευση ως PDF". Εδώ γίνεται όνομα + ημερομηνία +
// ώρα, ανανεωμένο τη στιγμή της εκτύπωσης, ώστε κάθε PDF να έχει δικό του όνομα (και με το κουμπί και με Ctrl+P).
// Το Next.js ξαναγράφει τον τίτλο μετά από πλοήγηση, οπότε ο observer τον επαναφέρει όποτε αλλάξει.
export function usePrintFileName(name) {
  useEffect(() => {
    if (!name) return undefined;
    const safeName = name.replace(/[\\/:*?"<>|]+/g, " ");
    const prevTitle = document.title;
    const apply = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
      document.title = `${safeName} ${stamp}`;
    };
    apply();
    window.addEventListener("beforeprint", apply);
    const observer = new MutationObserver(() => {
      if (!document.title.startsWith(safeName)) apply();
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", apply);
      document.title = prevTitle;
    };
  }, [name]);
}
