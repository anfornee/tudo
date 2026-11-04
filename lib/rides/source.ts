import { auth } from "@/lib/firebase-client";
import type { RideSource, SavedRide } from "@/lib/rides/types";

function getOriginalFileType(
	source: RideSource,
) {
	switch (source) {
		case "gpx":
			return "application/gpx+xml";

		case "fit":
			return "application/octet-stream";

		default:
			return "application/octet-stream";
	}
}

export async function getOriginalRideFile(
	ride: Pick<SavedRide, "id" | "originalFilePath" | "originalFileName" | "source">,
	signal?: AbortSignal,
): Promise<File> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error(
			"You must be signed in to load a ride file.",
		);
	}

	if (!ride.originalFilePath) {
		throw new Error(
			"The original activity file is not available for this ride.",
		);
	}

	const idToken =
		await user.getIdToken();

	const response = await fetch(
		`/api/rides/${ride.id}/source`,
		{
			method: "POST",
			signal,
			headers: {
				"Content-Type":
					"application/json",
				Authorization:
					`Bearer ${idToken}`,
			},
			body: JSON.stringify({
				originalFilePath:
					ride.originalFilePath,
			}),
		},
	);

	if (!response.ok) {
		let message =
			"Unable to load the original activity file.";

		try {
			const result =
				(await response.json()) as {
					error?: string;
				};

			if (result.error) {
				message = result.error;
			}
		} catch {
			// Response was not JSON.
		}

		throw new Error(message);
	}

	const blob =
		await response.blob();

	return new File(
		[blob],
		ride.originalFileName ||
			`ride.${ride.source}`,
		{
			type:
				blob.type ||
				getOriginalFileType(
					ride.source,
				),
		},
	);
}
