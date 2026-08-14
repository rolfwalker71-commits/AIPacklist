import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

/**
 * Gate the app behind a session cookie. Full validation happens in Node
 * (API routes / server pages) against the Session table.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const isPublic =
    pathname === "/login" ||
    pathname === "/login.html" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/setup") ||
    pathname.startsWith("/api/auth/status");

  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login.html";
    // keep ?next= / ?error=
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  if (isPublic) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login.html";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
