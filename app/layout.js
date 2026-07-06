import "./globals.css";
import AppShell from "@/components/AppShell";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata = {
  title: "Print Shop Accounting",
  description: "Invoicing, stock, and revenue/expense management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
