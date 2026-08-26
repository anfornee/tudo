import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	const session = request.cookies.get("session")?.value;
	const { pathname } = request.nextUrl;

	if (pathname.startsWith("/dashboard") && !session) {
		return NextResponse.redirect(
			new URL("/login", request.url)
		);
	}

	if (pathname === "/login" && session) {
		return NextResponse.redirect(
			new URL("/dashboard", request.url)
		);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/login", "/dashboard/:path*"],
};