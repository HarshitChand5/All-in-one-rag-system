import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  let token = request.cookies.get("auth_token")?.value;
  
  // Basic validation for token presence
  if (token === "undefined" || !token) {
    token = undefined;
  }

  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  
  const isDashboardPage = 
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/pdf-editor") ||
    pathname.startsWith("/resume");

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
