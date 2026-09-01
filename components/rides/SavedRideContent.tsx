"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
	ArrowLeft,
	Loader2,
	RefreshCw,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DeleteRideDialog } from "@/components/rides/DeleteRideDialog";
import { ReanalyzeRideDialog } from "@/components/rides/ReanalyzeRideDialog";
import type { ReanalysisStatus } from "@/components/rides/ReanalyzeRideDialog";
import { RideCharts } from "@/components/rides/RideCharts";
import { RideSummary } from "@/components/rides/RideSummary";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase-client";
import type { RideSample } from "@/lib/ride.types";
import {
	deleteRide,
	getRide,
	getRideSamples,
} from "@/lib/rides/persistence";
import { reanalyzeRide } from "@/lib/rides/reanalysis";
import type { SavedRide } from "@/lib/rides/types";

interface SavedRideContentProps {
	userId: string;
	rideId: string;
}

export function SavedRideContent({
	userId,
	rideId,
}: SavedRideContentProps) {
	const [ride, setRide] = useState<SavedRide | null>(null);
	const [loading, setLoading] = useState(true);

	const [samples, setSamples] =
		useState<RideSample[] | null>(null);

	const [samplesLoading, setSamplesLoading] =
		useState(false);

	const [reanalyzing, setReanalyzing] =
		useState(false);

	const [deleting, setDeleting] =
		useState(false);

	const [showReanalyzeDialog, setShowReanalyzeDialog] =
		useState(false);

	const [showDeleteDialog, setShowDeleteDialog] =
		useState(false);

	const [
		reanalysisStatus,
		setReanalysisStatus,
	] = useState<ReanalysisStatus>(
		"idle",
	);

	const [
		reanalysisError,
		setReanalysisError,
	] = useState<string | null>(
		null,
	);

	const [error, setError] =
		useState<string | null>(null);

	const [message, setMessage] =
		useState<string | null>(null);

	async function loadSamples(savedRide: SavedRide) {
		if (!savedRide.sampleFilePath) {
			setSamples(null);
			return;
		}

		setSamplesLoading(true);

		try {
			setSamples(
				await getRideSamples(savedRide),
			);
		} catch (error) {
			console.error(
				"Unable to load ride samples:",
				error,
			);

			setSamples(null);
		} finally {
			setSamplesLoading(false);
		}
	}

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

				void getRide(userId, rideId)
					.then((savedRide) => {
						if (!savedRide) {
							setError(
								"This saved ride could not be found.",
							);

							return;
						}

						setRide(savedRide);

						void loadSamples(savedRide);
					})
					.catch((error) => {
						console.error(
							"Unable to load ride:",
							error,
						);

						setError(
							"Unable to load this saved ride.",
						);
					})
					.finally(() => {
						setLoading(false);
					});
			},
		);

		return unsubscribe;
	}, [rideId, userId]);

	async function handleReanalyze() {
		if (
			!ride ||
			reanalyzing ||
			deleting
		) {
			return;
		}

		setReanalyzing(true);
		setReanalysisStatus(
			"idle",
		);
		setReanalysisError(null);
		setError(null);
		setMessage(null);

		try {
			const result =
				await reanalyzeRide(
					userId,
					ride.id,
				);

			setRide(result.ride);

			await loadSamples(
				result.ride,
			);

			setReanalysisStatus(
				"success",
			);
		} catch (error) {
			console.error(
				"Unable to re-analyze ride:",
				error,
			);

			const message =
				error instanceof Error
					? error.message
					: "Unable to re-analyze this ride. Please try again.";

			setReanalysisError(
				message,
			);

			setReanalysisStatus(
				"error",
			);
		} finally {
			setReanalyzing(false);
		}
	}

	async function handleDelete() {
		if (!ride || deleting || reanalyzing) {
			return;
		}

		setDeleting(true);
		setError(null);
		setMessage(null);

		try {
			await deleteRide(
				userId,
				ride,
			);

			window.location.assign("/rides");
		} catch (error) {
			console.error(
				"Unable to delete ride:",
				error,
			);

			setError(
				"Unable to delete this ride. Please try again.",
			);

			setDeleting(false);
		}
	}

	if (loading) {
		return (
			<div className="flex min-h-48 items-center justify-center rounded-xl border bg-card">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!ride) {
		return (
			<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
				{error ??
					"This saved ride could not be found."}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
				<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
					<Link
						href="/rides"
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft className="size-4" />
						Back to rides
					</Link>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								reanalyzing ||
								deleting ||
								!ride.originalFilePath
							}
							onClick={() => {
								setReanalysisStatus("idle");
								setReanalysisError(null);
								setShowReanalyzeDialog(true);
							}}
							title={
								ride.originalFilePath
									? "Re-analyze the original activity file"
									: "Original activity file unavailable"
							}
						>
							{reanalyzing ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<RefreshCw className="size-4" />
							)}

							{reanalyzing
								? "Analyzing…"
								: "Re-analyze"}
						</Button>

						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={
								deleting ||
								reanalyzing
							}
							onClick={() =>
								setShowDeleteDialog(true)
							}
							className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
						>
							{deleting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Trash2 className="size-4" />
							)}

							{deleting
								? "Deleting…"
								: "Delete"}
						</Button>
					</div>
				</div>

				{error && (
					<p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</p>
				)}

				{message && (
					<p className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
						{message}
					</p>
				)}

				<RideSummary
					ride={ride}
					source={ride.source}
					activityDate={
						(
							ride.activityDate ??
							ride.importedAt
						)?.toDate() ??
						null
					}
					fileName={
						ride.originalFileName
					}
				/>
			</section>

			{samplesLoading ? (
				<div className="flex min-h-40 items-center justify-center rounded-xl border bg-card">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : (
				<RideCharts samples={samples} />
			)}

			<ReanalyzeRideDialog
				ride={ride}
				open={showReanalyzeDialog}
				processing={reanalyzing}
				status={reanalysisStatus}
				errorMessage={reanalysisError}
				onOpenChange={(open) => {
					if (!reanalyzing) {
						setShowReanalyzeDialog(
							open,
						);

						if (!open) {
							setReanalysisStatus(
								"idle",
							);

							setReanalysisError(
								null,
							);
						}
					}
				}}
				onConfirm={() => {
					void handleReanalyze();
				}}
			/>

			<DeleteRideDialog
				ride={ride}
				open={showDeleteDialog}
				deleting={deleting}
				onOpenChange={(open) => {
					if (!deleting) {
						setShowDeleteDialog(open);
					}
				}}
				onConfirm={() => {
					void handleDelete();
				}}
			/>
		</div>
	);
}