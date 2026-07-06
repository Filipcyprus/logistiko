import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_EXACT = new Set(["/login", "/api/auth/login"]);

// Παραλαβή αποθέματος από προμηθευτή — κοινό και για Manager και για Cashier.
function isReceivingAllowed(pathname) {
  const pagePrefixes = ["/agores", "/exoda", "/promitheutes"];
  if (pagePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  const apiPrefixes = ["/api/purchases", "/api/suppliers", "/api/expenses", "/api/stock"];
  if (apiPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return false;
}

// Cashier: Ταμείο (POS), κρατημένες πωλήσεις, βάρδιες + παραλαβή αποθέματος.
function isCashierAllowed(pathname) {
  if (pathname === "/tameio") return true;
  if (pathname === "/api/auth/logout" || pathname === "/api/auth/me") return true;
  if (/^\/parastatika\/[^/]+$/.test(pathname) && pathname !== "/parastatika/neo") return true;
  if (pathname.startsWith("/api/held-sales")) return true;
  if (pathname.startsWith("/api/shifts")) return true;
  if (pathname.startsWith("/api/products")) return true;
  if (pathname.startsWith("/api/invoices")) return true;
  if (pathname.startsWith("/api/customers")) return true;
  if (pathname === "/api/settings") return true;
  if (isReceivingAllowed(pathname)) return true;
  return false;
}

// Manager: αποθήκη, προϊόντα, παραγγελίες, προμηθευτές, αγορές/παραλαβή — όχι ρυθμίσεις.
function isManagerAllowed(pathname) {
  if (pathname === "/api/auth/logout" || pathname === "/api/auth/me") return true;
  const pagePrefixes = ["/apothiki", "/paraggelies", "/promitheutes", "/agores", "/exoda"];
  if (pagePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  const apiPrefixes = ["/api/products", "/api/stock", "/api/categories", "/api/orders", "/api/suppliers", "/api/purchases", "/api/expenses", "/api/customers", "/api/settings"];
  if (apiPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Δημόσιες διαδρομές: B2B portal, login, στατικά αρχεία.
  if (
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/portal") ||
    pathname.startsWith("/api/users") ||
    PUBLIC_EXACT.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "errors.unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Μόνο ο owner έχει πλήρη πρόσβαση από προεπιλογή. Κάθε άλλος ρόλος (γνωστός ή μη)
  // περνάει από ρητό έλεγχο επιτρεπόμενων διαδρομών — άγνωστος ρόλος = καμία πρόσβαση.
  if (session.role === "owner") {
    return NextResponse.next();
  }

  let allowed;
  let fallbackPage;
  if (session.role === "cashier") {
    allowed = isCashierAllowed(pathname);
    fallbackPage = "/tameio";
  } else if (session.role === "manager") {
    allowed = isManagerAllowed(pathname);
    fallbackPage = "/apothiki";
  } else {
    allowed = pathname === "/api/auth/logout" || pathname === "/api/auth/me";
    fallbackPage = "/login";
  }

  if (!allowed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(fallbackPage, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
