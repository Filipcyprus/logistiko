"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// Το portal (B2B, πελάτες) δεν εμφανίζει το μενού διαχείρισης.
export default function AppShell({ children }) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith("/portal");

  if (isPortal) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
