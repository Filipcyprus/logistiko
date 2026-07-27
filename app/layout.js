import "./globals.css";
import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export const metadata = {
  title: "Altifil Holdings LTD",
  description: "Invoicing, stock, and revenue/expense management",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Altifil",
  },
};

export const viewport = {
  themeColor: "#4d6690",
};

export default async function RootLayout({ children }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const role = session?.role || null;

  return (
    <html lang="en">
      <body>
        <RegisterServiceWorker />
        <LanguageProvider>
          <AppShell role={role}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
