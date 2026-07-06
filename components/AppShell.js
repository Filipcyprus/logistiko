"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// Το portal (B2B, πελάτες) και η σελίδα σύνδεσης δεν εμφανίζουν το μενού διαχείρισης.
export default function AppShell({ children, role }) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith("/portal");
  const isLogin = pathname === "/login";

  if (isPortal || isLogin) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
