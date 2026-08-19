import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  // 1. If the user doesn't have a session cookie and is trying to access protected pages
  if (!session && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    // Redirect them to login, remembering where they wanted to go
    loginUrl.searchParams.set("callbackUrl", pathname); 
    return NextResponse.redirect(loginUrl);
  }

  // 2. If the user is logged in and tries to visit login/signup pages, redirect to dashboard
  if (session && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Config to specify exactly which routes trigger this middleware
export const config = {
  matcher: [
    "/dashboard/:path*", // Protects /dashboard and any nested sub-routes
    "/login",
    "/signup",
  ],
};
