import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
	const session = request.cookies.get("session")?.value;
	const { pathname } = request.nextUrl;

	const isProtectedRoute = ["/dashboard", "/weather", "/sudoku", "/rides"].some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);

	if (isProtectedRoute && !session) {
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
	matcher: ["/login", "/dashboard/:path*", "/weather/:path*", "/sudoku/:path*", "/rides/:path*"],
};
