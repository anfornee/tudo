// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Change 'export function middleware' to 'export function proxy'
export async function proxy(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  if (!session && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname); 
    return NextResponse.redirect(loginUrl);
  }

  if (session && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
