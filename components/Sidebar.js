"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const nav = [
  { href: "/", key: "nav.dashboard", icon: "dashboard" },
  { href: "/tameio", key: "nav.pos", icon: "cart" },
  { href: "/prosfores", key: "nav.quotes", icon: "quote" },
  { href: "/paraggelies", key: "nav.orders", icon: "order" },
  { href: "/ergasies", key: "nav.jobs", icon: "jobs" },
  { href: "/parastatika", key: "nav.invoices", icon: "invoice" },
  { href: "/pelates", key: "nav.customers", icon: "users" },
  { href: "/promitheutes", key: "nav.suppliers", icon: "truck" },
  { href: "/apothiki", key: "nav.stock", icon: "box" },
  { href: "/exoda", key: "nav.expenses", icon: "wallet" },
  { href: "/anafores", key: "nav.reports", icon: "report" },
  { href: "/rythmiseis", key: "nav.settings", icon: "settings" },
];

const cashierNav = [
  { href: "/tameio", key: "nav.pos", icon: "cart" },
  { href: "/exoda?tab=purchases", key: "nav.receiving", icon: "box" },
];

const managerNav = [
  { href: "/apothiki", key: "nav.stock", icon: "box" },
  { href: "/paraggelies", key: "nav.orders", icon: "order" },
  { href: "/promitheutes", key: "nav.suppliers", icon: "truck" },
  { href: "/exoda", key: "nav.expenses", icon: "wallet" },
];

export default function Sidebar({ role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const items = role === "cashier" ? cashierNav : role === "manager" ? managerNav : nav;

  const isActive = (href) => {
    const base = href.split("?")[0];
    return base === "/" ? pathname === "/" : pathname.startsWith(base);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <>
      {/* Κινητό: μπάρα πάνω */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-slate-900 text-white px-4 py-3 no-print">
        <span className="font-semibold text-sm tracking-wide">{t("common.appName")}</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={() => setOpen(!open)} className="text-slate-300 hover:text-white">
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } md:block w-full md:w-60 shrink-0 bg-slate-900 text-slate-300 md:min-h-screen no-print`}
      >
        <div className="sticky top-0 p-4 flex flex-col md:h-screen">
          <div className="flex items-center gap-2.5 mb-6 px-2 pt-1">
            <div className="w-7 h-7 rounded bg-brand-500 flex items-center justify-center text-white">
              <Icon name="invoice" size={15} strokeWidth={2} />
            </div>
            <div>
              <div className="text-white text-sm font-semibold leading-tight">{t("common.appName")}</div>
              <div className="text-[11px] text-slate-500">{t("common.appSubtitle")}</div>
            </div>
          </div>
          <nav className="space-y-0.5 flex-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                }`}
              >
                <Icon name={item.icon} size={16} />
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <button onClick={logout} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 mb-1">
            <Icon name="x" size={16} />
            {t("nav.logout")}
          </button>
          <div className="hidden md:flex px-2 pt-3 mt-3 border-t border-slate-800">
            <LanguageSwitcher />
          </div>
        </div>
      </aside>
    </>
  );
}
