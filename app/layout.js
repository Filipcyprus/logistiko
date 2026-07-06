import "./globals.css";
import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export const metadata = {
  title: "Print Shop Accounting",
  description: "Invoicing, stock, and revenue/expense management",
};

export default async function RootLayout({ children }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const role = session?.role || null;

  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AppShell role={role}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
