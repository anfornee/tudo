"use client";

import {
	CheckCircle2,
	Loader2,
	RefreshCw,
	TriangleAlert,
} from "lucide-react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SavedRide } from "@/lib/rides/types";

export type ReanalysisStatus =
	| "idle"
	| "success"
	| "error";

interface ReanalyzeRideDialogProps {
	ride: SavedRide | null;
	open: boolean;
	processing: boolean;
	status: ReanalysisStatus;
	errorMessage?: string | null;
	onOpenChange: (
		open: boolean,
	) => void;
	onConfirm: () => void;
}

function rideDate(
	ride: SavedRide,
) {
	return (
		(
			ride.activityDate ??
			ride.importedAt
		)?.toDate() ??
		null
	);
}

export function ReanalyzeRideDialog({
	ride,
	open,
	processing,
	status,
	errorMessage,
	onOpenChange,
	onConfirm,
}: ReanalyzeRideDialogProps) {
	const successful =
		status === "success";

	const failed =
		status === "error";

	return (
		<AlertDialog
			open={open}
			onOpenChange={
				onOpenChange
			}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{successful
							? "Ride re-analyzed"
							: failed
								? "Re-analysis failed"
								: "Re-analyze this ride?"}
					</AlertDialogTitle>

					<AlertDialogDescription>
						<div className="space-y-3">
							{successful ? (
								<div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-foreground">
									<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />

									<p>
										The ride was
										successfully
										re-analyzed using
										the original activity
										file. Its calculated
										metrics and chart data
										have been refreshed.
									</p>
								</div>
							) : failed ? (
								<div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-foreground">
									<TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />

									<p>
										{errorMessage ??
											"Something went wrong while re-analyzing this ride. Please try again."}
									</p>
								</div>
							) : ride ? (
								<p>
									Tudo will process the
									original{" "}
									{ride.source.toUpperCase()}{" "}
									file from{" "}
									{rideDate(
										ride,
									)?.toLocaleDateString() ??
										"this ride"}{" "}
									again using the current
									ride parser. This will
									refresh the calculated
									metrics and detailed chart
									data. The original activity
									file will not be changed.
								</p>
							) : (
								<p>
									Tudo will process the
									original activity file
									again using the current
									ride parser.
								</p>
							)}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					{successful ? (
						<AlertDialogAction>
							Done
						</AlertDialogAction>
					) : (
						<>
							<AlertDialogCancel
								disabled={
									processing
								}
							>
								{failed
									? "Close"
									: "Cancel"}
							</AlertDialogCancel>

							<AlertDialogAction
								disabled={
									processing ||
									!ride ||
									!ride.originalFilePath
								}
								onClick={(
									event,
								) => {
									event.preventDefault();
									onConfirm();
								}}
							>
								{processing ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Analyzing…
									</>
								) : (
									<>
										<RefreshCw className="size-4" />
										{failed
											? "Try again"
											: "Re-analyze ride"}
									</>
								)}
							</AlertDialogAction>
						</>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}