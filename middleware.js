import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_EXACT = new Set(["/login", "/api/auth/login"]);

function isStaffAllowed(pathname) {
  if (pathname === "/tameio") return true;
  if (pathname === "/api/auth/logout") return true;
  if (/^\/parastatika\/[^/]+$/.test(pathname) && pathname !== "/parastatika/neo") return true;
  if (pathname.startsWith("/api/products")) return true;
  if (pathname.startsWith("/api/invoices")) return true;
  if (pathname.startsWith("/api/customers")) return true;
  if (pathname === "/api/settings") return true;
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Δημόσιες διαδρομές: B2B portal, login, στατικά αρχεία.
  // Το /api/users επιτρέπεται πάντα να περάσει: το route handler κάνει τον δικό του
  // έλεγχο owner-only (με εξαίρεση bootstrap όταν δεν υπάρχει ακόμα κανένας χρήστης).
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

  if (session.role === "staff" && !isStaffAllowed(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/tameio", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
