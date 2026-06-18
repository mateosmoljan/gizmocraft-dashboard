import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = new Set([
  "/",
  "/dashboard",
  "/players",
  "/leaderboards",
  "/profile",
  "/profiles",
  "/screenshots",
  "/usage",
  "/world",
]);

function hasAuthCookie(request: NextRequest) {
  return [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ].some((name) => Boolean(request.cookies.get(name)?.value));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = hasAuthCookie(request);

  if (pathname === "/signing" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (protectedRoutes.has(pathname) && !signedIn) {
    return NextResponse.redirect(new URL("/signing", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/players", "/leaderboards", "/profile", "/profiles", "/screenshots", "/usage", "/world", "/signing"],
};
