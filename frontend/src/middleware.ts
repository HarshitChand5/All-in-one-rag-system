import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  let token = request.cookies.get("auth_token")?.value;
  
  // Robust check: Ignore "undefined" strings or tokens that are not valid JWTs (3 segments)
  if (token === "undefined" || (token && (token.length < 20 || token.split('.').length !== 3))) {
    token = undefined;
  }

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || 
                     request.nextUrl.pathname.startsWith("/signup");
  
  const isDashboardPage = request.nextUrl.pathname.startsWith("/dashboard") ||
                          request.nextUrl.pathname.startsWith("/chat") ||
                          request.nextUrl.pathname.startsWith("/documents") ||
                          request.nextUrl.pathname.startsWith("/profile") ||
                          request.nextUrl.pathname.startsWith("/settings") ||
                          request.nextUrl.pathname.startsWith("/insights") ||
                          request.nextUrl.pathname.startsWith("/images") ||
                          request.nextUrl.pathname.startsWith("/pdf-editor") ||
                          request.nextUrl.pathname.startsWith("/resume");

  if (isDashboardPage && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", 
    "/chat/:path*", 
    "/documents/:path*", 
    "/profile/:path*",
    "/settings/:path*",
    "/insights/:path*",
    "/images/:path*",
    "/pdf-editor/:path*",
    "/resume/:path*",
    "/login", 
    "/signup"
  ],
};
