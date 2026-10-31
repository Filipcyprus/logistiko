import { useEffect } from "react";

// Οι browsers προτείνουν το document.title ως όνομα αρχείου στο "Αποθήκευση ως PDF". Εδώ γίνεται όνομα + ημερομηνία +
// ώρα, ανανεωμένο τη στιγμή της εκτύπωσης, ώστε κάθε PDF να έχει δικό του όνομα (και με το κουμπί και με Ctrl+P).
export function usePrintFileName(name) {
  useEffect(() => {
    if (!name) return undefined;
    const prevTitle = document.title;
    const apply = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
      document.title = `${name} ${stamp}`.replace(/[\\/:*?"<>|]+/g, " ");
    };
    apply();
    window.addEventListener("beforeprint", apply);
    return () => {
      window.removeEventListener("beforeprint", apply);
      document.title = prevTitle;
    };
  }, [name]);
}
