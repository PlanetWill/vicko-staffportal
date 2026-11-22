import { NextResponse } from "next/server";
import { isDiscordAuthConfigured } from "./auth";

export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const configured = isDiscordAuthConfigured();
  const hasSessionCookie = request.cookies.has("authjs.session-token") || request.cookies.has("__Secure-authjs.session-token");
  if (configured && hasSessionCookie) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("callbackUrl", `${pathname}${search}`);
  if (!configured) login.searchParams.set("error", "Configuration");
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt)$).*)"],
};
