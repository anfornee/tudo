import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

interface SourceRequest {
	originalFilePath: string;
}

export async function POST(
	request: Request,
	{
		params,
	}: {
		params: Promise<{
			rideId: string;
		}>;
	},
) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json(
			{
				error: "Unauthorized.",
			},
			{
				status: 401,
			},
		);
	}

	const { rideId } = await params;

	let body: SourceRequest;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{
				error: "Invalid request.",
			},
			{
				status: 400,
			},
		);
	}

	const { originalFilePath } = body;

	if (
		!originalFilePath ||
		typeof originalFilePath !== "string"
	) {
		return NextResponse.json(
			{
				error: "Original activity file path is required.",
			},
			{
				status: 400,
			},
		);
	}

	/*
	 * Never allow the browser to ask this endpoint for an
	 * arbitrary Storage object.
	 */
	const expectedPrefix =
		`users/${user.uid}/rides/${rideId}/`;

	if (
		!originalFilePath.startsWith(
			expectedPrefix,
		)
	) {
		return NextResponse.json(
			{
				error:
					"Activity file does not belong to this ride.",
			},
			{
				status: 403,
			},
		);
	}

	const authorization =
		request.headers.get("authorization");

	if (
		!authorization?.startsWith("Bearer ")
	) {
		return NextResponse.json(
			{
				error:
					"Firebase authorization token is required.",
			},
			{
				status: 401,
			},
		);
	}

	/*
	 * Firebase Storage's REST endpoint understands the same
	 * Firebase ID token used by the browser SDK.
	 *
	 * Because THIS fetch happens server-side, browser CORS
	 * rules do not apply.
	 */
	const encodedPath =
		encodeURIComponent(
			originalFilePath,
		);

	const storageUrl =
		`https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

	let storageResponse: Response;

	try {
		storageResponse = await fetch(
			storageUrl,
			{
				headers: {
					Authorization:
						authorization,
				},
				cache: "no-store",
			},
		);
	} catch (error) {
		console.error(
			"Unable to contact Firebase Storage:",
			error,
		);

		return NextResponse.json(
			{
				error:
					"Unable to load the original activity file.",
			},
			{
				status: 502,
			},
		);
	}

	if (!storageResponse.ok) {
		console.error(
			"Firebase Storage source download failed:",
			storageResponse.status,
			storageResponse.statusText,
		);

		if (
			storageResponse.status === 404
		) {
			return NextResponse.json(
				{
					error:
						"The original activity file could not be found.",
				},
				{
					status: 404,
				},
			);
		}

		return NextResponse.json(
			{
				error:
					"Unable to load the original activity file.",
			},
			{
				status:
					storageResponse.status,
			},
		);
	}

	const bytes =
		await storageResponse.arrayBuffer();

	const contentType =
		storageResponse.headers.get(
			"content-type",
		) ??
		"application/octet-stream";

	return new Response(bytes, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Length":
				String(bytes.byteLength),
			"Cache-Control":
				"no-store",
		},
	});
}