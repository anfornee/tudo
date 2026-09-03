import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

interface SamplesRequest {
	sampleFilePath: string;
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

	let body: SamplesRequest;

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

	if (
		!body.sampleFilePath ||
		typeof body.sampleFilePath !== "string"
	) {
		return NextResponse.json(
			{
				error: "Ride sample path is required.",
			},
			{
				status: 400,
			},
		);
	}

	const expectedPrefix =
		`users/${user.uid}/rides/${rideId}/`;

	if (
		!body.sampleFilePath.startsWith(
			expectedPrefix,
		)
	) {
		return NextResponse.json(
			{
				error:
					"Ride sample data does not belong to this ride.",
			},
			{
				status: 403,
			},
		);
	}

	const authorization =
		request.headers.get("authorization");

	if (
		!authorization?.startsWith(
			"Bearer ",
		)
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

	const encodedPath =
		encodeURIComponent(
			body.sampleFilePath,
		);

	const storageUrl =
		`https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

	const storageResponse =
		await fetch(
			storageUrl,
			{
				headers: {
					Authorization:
						authorization,
				},
				cache: "no-store",
			},
		);

	if (!storageResponse.ok) {
		console.error(
			"Firebase Storage sample download failed:",
			storageResponse.status,
			storageResponse.statusText,
		);

		return NextResponse.json(
			{
				error:
					storageResponse.status === 404
						? "Ride sample data could not be found."
						: "Unable to load ride sample data.",
			},
			{
				status:
					storageResponse.status,
			},
		);
	}

	const bytes =
		await storageResponse.arrayBuffer();

	return new Response(bytes, {
		status: 200,
		headers: {
			"Content-Type":
				"application/json",
			"Content-Length":
				String(
					bytes.byteLength,
				),
			"Cache-Control":
				"no-store",
		},
	});
}