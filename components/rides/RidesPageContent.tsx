"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
	Bike,
	FileUp,
	Loader2,
	RefreshCw,
	Trash2,
	Upload,
} from "lucide-react";
import Link from "next/link";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { DeleteRideDialog } from "@/components/rides/DeleteRideDialog";
import { ReanalyzeRideDialog } from "@/components/rides/ReanalyzeRideDialog";
import { RideHistoryAnalytics } from "@/components/rides/RideHistoryAnalytics";
import { RideSummary } from "@/components/rides/RideSummary";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase-client";
import {
	formatElevationGain,
	formatRideDistance,
} from "@/lib/rides/formatters";
import {
	getRideFileSource,
	processRideFile,
} from "@/lib/rides/import";
import {
	deleteRide,
	getRides,
	saveRide,
} from "@/lib/rides/persistence";
import { reanalyzeRide } from "@/lib/rides/reanalysis";
import type {
	ProcessedRide,
	SavedRide,
} from "@/lib/rides/types";
import { cn } from "@/lib/utils";

interface RidesPageContentProps {
	userId: string;
}

function rideDate(ride: SavedRide) {
	return (
		(ride.activityDate ?? ride.importedAt)?.toDate() ??
		null
	);
}

export function RidesPageContent({
	userId,
}: RidesPageContentProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const [rides, setRides] = useState<SavedRide[]>([]);

	const [processedRide, setProcessedRide] =
		useState<ProcessedRide | null>(null);

	const [loadingRides, setLoadingRides] =
		useState(true);

	const [processing, setProcessing] =
		useState(false);

	const [saving, setSaving] =
		useState(false);

	const [dragging, setDragging] =
		useState(false);

	const [savedRideId, setSavedRideId] =
		useState<string | null>(null);

	const [rideToDelete, setRideToDelete] =
		useState<SavedRide | null>(null);

	const [deletingRideId, setDeletingRideId] =
		useState<string | null>(null);

	const [rideToReanalyze, setRideToReanalyze] =
		useState<SavedRide | null>(null);

	const [
		reanalyzingRideId,
		setReanalyzingRideId,
	] = useState<string | null>(null);

	const [error, setError] =
		useState<string | null>(null);

	const [saveMessage, setSaveMessage] =
		useState<string | null>(null);

	const loadRides = useCallback(async () => {
		setLoadingRides(true);

		try {
			setRides(
				await getRides(userId),
			);
		} catch (error) {
			console.error(
				"Unable to load rides:",
				error,
			);

			setError(
				"Unable to load your previous rides.",
			);
		} finally {
			setLoadingRides(false);
		}
	}, [userId]);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(
			auth,
			(user) => {
				if (!user || user.uid !== userId) {
					window.location.assign(
						"/api/auth/logout",
					);
					return;
				}

				void loadRides();
			},
		);

		return unsubscribe;
	}, [loadRides, userId]);

	async function processFile(
		file: File | undefined,
	) {
		if (!file || processing || saving) {
			return;
		}

		setError(null);
		setSaveMessage(null);
		setProcessedRide(null);
		setSavedRideId(null);

		if (!getRideFileSource(file.name)) {
			setError(
				"Choose a .fit or .gpx cycling activity file.",
			);
			return;
		}

		setProcessing(true);

		try {
			setProcessedRide(
				await processRideFile(file),
			);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Unable to process this activity file.",
			);
		} finally {
			setProcessing(false);

			if (inputRef.current) {
				inputRef.current.value = "";
			}
		}
	}

	async function handleSave() {
		if (!processedRide || saving) {
			return;
		}

		setSaving(true);
		setError(null);
		setSaveMessage(null);

		try {
			const saved = await saveRide(
				userId,
				processedRide.file,
				processedRide.ride,
				processedRide.activityDate,
			);

			setSavedRideId(saved.id);

			await loadRides();

			setSaveMessage(
				"Ride saved. The original activity file was preserved.",
			);
		} catch (error) {
			console.error(
				"Unable to save ride:",
				error,
			);

			setError(
				"Unable to save the ride and original file. Please try again.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleReanalyzeRide() {
		if (
			!rideToReanalyze ||
			reanalyzingRideId ||
			deletingRideId
		) {
			return;
		}

		const ride = rideToReanalyze;

		setReanalyzingRideId(
			ride.id,
		);

		setError(null);
		setSaveMessage(null);

		try {
			const result =
				await reanalyzeRide(
					userId,
					ride.id,
				);

			/*
			 * Replace this ride with the newly analyzed
			 * summary. RideHistoryAnalytics receives the
			 * updated rides array, so distance totals,
			 * calendar data, and streak data update too.
			 */
			setRides((currentRides) =>
				currentRides.map(
					(currentRide) =>
						currentRide.id ===
						result.ride.id
							? result.ride
							: currentRide,
				),
			);

			setRideToReanalyze(null);

			setSaveMessage(
				"Ride re-analyzed using the original activity file.",
			);
		} catch (error) {
			console.error(
				"Unable to re-analyze ride:",
				error,
			);

			setError(
				error instanceof Error
					? error.message
					: "Unable to re-analyze this ride. Please try again.",
			);
		} finally {
			setReanalyzingRideId(null);
		}
	}

	async function handleDeleteRide() {
		if (
			!rideToDelete ||
			deletingRideId ||
			reanalyzingRideId
		) {
			return;
		}

		const ride = rideToDelete;

		setDeletingRideId(
			ride.id,
		);

		setError(null);
		setSaveMessage(null);

		try {
			await deleteRide(
				userId,
				ride,
			);

			/*
			 * Immediately remove the deleted ride from
			 * local state so all overview analytics update
			 * without needing another Firestore request.
			 */
			setRides((currentRides) =>
				currentRides.filter(
					(currentRide) =>
						currentRide.id !==
						ride.id,
				),
			);

			setRideToDelete(null);

			setSaveMessage(
				"Ride deleted.",
			);
		} catch (error) {
			console.error(
				"Unable to delete ride:",
				error,
			);

			setError(
				"Unable to delete this ride. Please try again.",
			);
		} finally {
			setDeletingRideId(null);
		}
	}

	const rideActionInProgress =
		reanalyzingRideId !== null ||
		deletingRideId !== null;

	return (
		<div className="space-y-8">
			{!loadingRides && (
				<RideHistoryAnalytics
					rides={rides.map(
						(ride) => ({
							id: ride.id,
							date: rideDate(ride),
							distanceMiles:
								ride.distanceMiles,
							durationSeconds:
								ride.durationSeconds,
							elevationGainFeet:
								ride.elevationGainFeet,
						}),
					)}
				/>
			)}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] lg:items-start">
				<section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
					<div>
						<h2 className="font-semibold">
							Upload new ride
						</h2>

						<p className="mt-1 text-sm text-muted-foreground">
							Import a FIT or GPX
							cycling activity, review
							it, then save it.
						</p>
					</div>

					<input
						ref={inputRef}
						type="file"
						accept=".fit,.gpx,application/gpx+xml"
						className="sr-only"
						disabled={
							processing ||
							saving
						}
						onChange={(event) =>
							void processFile(
								event.target
									.files?.[0],
							)
						}
					/>

					<button
						type="button"
						disabled={
							processing ||
							saving
						}
						onClick={() =>
							inputRef.current?.click()
						}
						onDragEnter={(event) => {
							event.preventDefault();
							setDragging(true);
						}}
						onDragOver={(event) => {
							event.preventDefault();
						}}
						onDragLeave={() => {
							setDragging(false);
						}}
						onDrop={(event) => {
							event.preventDefault();
							setDragging(false);

							void processFile(
								event.dataTransfer
									.files[0],
							);
						}}
						className={cn(
							"flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
							dragging
								? "border-primary bg-primary/10"
								: "border-border bg-background hover:bg-muted/40",
						)}
					>
						{processing ? (
							<Loader2 className="size-7 animate-spin text-primary" />
						) : (
							<Upload className="size-7 text-muted-foreground" />
						)}

						<span className="mt-3 font-medium">
							{processing
								? "Processing ride…"
								: "Choose a file or drop it here"}
						</span>

						<span className="mt-1 text-sm text-muted-foreground">
							FIT or GPX, up to 10 MB
						</span>
					</button>

					{error && (
						<p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</p>
					)}

					{saveMessage && (
						<p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
							{saveMessage}
						</p>
					)}

					{processedRide && (
						<div className="space-y-4 border-t pt-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="min-w-0">
									<h3 className="font-semibold">
										Processed
										locally
									</h3>

									<p className="truncate text-sm text-muted-foreground">
										{
											processedRide
												.file
												.name
										}
									</p>
								</div>

								<Button
									type="button"
									disabled={
										saving ||
										savedRideId !==
											null
									}
									onClick={
										handleSave
									}
								>
									{saving ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<FileUp className="size-4" />
									)}

									{saving
										? "Saving…"
										: savedRideId
											? "Saved"
											: "Save ride"}
								</Button>
							</div>

							{savedRideId && (
								<Link
									href={`/rides/${savedRideId}`}
									className="inline-flex text-sm font-medium text-primary hover:underline"
								>
									Open saved
									ride
								</Link>
							)}

							<RideSummary
								ride={
									processedRide.ride
								}
								source={
									processedRide
										.ride
										.source
								}
								activityDate={
									processedRide
										.activityDate
								}
							/>
						</div>
					)}
				</section>

				<section className="space-y-4">
					<div>
						<h2 className="font-semibold">
							Previous rides
						</h2>

						<p className="mt-1 text-sm text-muted-foreground">
							Saved activity summaries,
							newest ride first.
						</p>
					</div>

					{loadingRides ? (
						<div className="flex min-h-28 items-center justify-center rounded-xl border bg-card">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : rides.length === 0 ? (
						<div className="rounded-xl border border-dashed bg-card/50 px-5 py-8 text-center">
							<Bike className="mx-auto size-7 text-muted-foreground" />

							<p className="mt-2 font-medium">
								No saved rides yet
							</p>

							<p className="mt-1 text-sm text-muted-foreground">
								Your imported rides
								will appear here.
							</p>
						</div>
					) : (
						<ul className="grid gap-3">
							{rides.map(
								(ride) => (
									<li
										key={
											ride.id
										}
										className="flex items-stretch overflow-hidden rounded-xl border bg-card shadow-sm"
									>
										<Link
											href={`/rides/${ride.id}`}
											className="min-w-0 flex-1 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="font-medium">
														{rideDate(
															ride,
														)?.toLocaleDateString() ??
															"Date unavailable"}
													</p>

													<p className="mt-1 truncate text-xs text-muted-foreground">
														{
															ride.originalFileName
														}
													</p>
												</div>

												<span className="rounded-md bg-muted px-2 py-1 text-xs font-medium uppercase">
													{
														ride.source
													}
												</span>
											</div>

											<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
												<span>
													{formatRideDistance(
														ride.distanceMiles,
													)}
												</span>

												<span>
													{Math.round(
														ride.durationSeconds /
															60,
													)}{" "}
													min
												</span>

												{ride.averagePower !==
													null && (
													<span>
														{Math.round(
															ride.averagePower,
														)}{" "}
														W
														avg
													</span>
												)}

												<span>
													{formatElevationGain(
														ride.elevationGainFeet,
													)}
												</span>
											</div>
										</Link>

										<div className="flex flex-col items-center justify-center gap-1 border-l px-2">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												disabled={
													rideActionInProgress ||
													!ride.originalFilePath
												}
												onClick={() =>
													setRideToReanalyze(
														ride,
													)
												}
												className="text-muted-foreground hover:text-foreground"
												aria-label={`Re-analyze ride from ${
													rideDate(
														ride,
													)?.toLocaleDateString() ??
													"unknown date"
												}`}
												title={
													ride.originalFilePath
														? "Re-analyze original activity file"
														: "Original activity file unavailable"
												}
											>
												{reanalyzingRideId ===
												ride.id ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<RefreshCw className="size-4" />
												)}
											</Button>

											<Button
												type="button"
												variant="ghost"
												size="icon"
												disabled={
													rideActionInProgress
												}
												onClick={() =>
													setRideToDelete(
														ride,
													)
												}
												className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
												aria-label={`Delete ride from ${
													rideDate(
														ride,
													)?.toLocaleDateString() ??
													"unknown date"
												}`}
												title="Delete ride"
											>
												{deletingRideId ===
												ride.id ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Trash2 className="size-4" />
												)}
											</Button>
										</div>
									</li>
								),
							)}
						</ul>
					)}
				</section>
			</div>

			<ReanalyzeRideDialog
				ride={rideToReanalyze}
				open={
					rideToReanalyze !== null
				}
				processing={
					reanalyzingRideId !== null
				}
				onOpenChange={(open) => {
					if (
						!open &&
						reanalyzingRideId === null
					) {
						setRideToReanalyze(
							null,
						);
					}
				}}
				onConfirm={() => {
					void handleReanalyzeRide();
				}}
			/>

			<DeleteRideDialog
				ride={rideToDelete}
				open={rideToDelete !== null}
				deleting={
					deletingRideId !== null
				}
				onOpenChange={(open) => {
					if (
						!open &&
						deletingRideId === null
					) {
						setRideToDelete(
							null,
						);
					}
				}}
				onConfirm={() => {
					void handleDeleteRide();
				}}
			/>
		</div>
	);
}