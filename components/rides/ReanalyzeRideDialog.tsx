"use client";

import {
	Loader2,
	RefreshCw,
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

interface ReanalyzeRideDialogProps {
	ride: SavedRide | null;
	open: boolean;
	processing: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

function rideDate(ride: SavedRide) {
	return (
		(ride.activityDate ?? ride.importedAt)?.toDate() ??
		null
	);
}

export function ReanalyzeRideDialog({
	ride,
	open,
	processing,
	onOpenChange,
	onConfirm,
}: ReanalyzeRideDialogProps) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={onOpenChange}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Re-analyze this ride?
					</AlertDialogTitle>

					<AlertDialogDescription>
						{ride ? (
							<>
								Tudo will process the original{" "}
								{ride.source.toUpperCase()} file
								from{" "}
								{rideDate(
									ride,
								)?.toLocaleDateString() ??
									"this ride"}{" "}
								again using the current ride
								parser.
								{" "}
								This will refresh the calculated
								metrics and detailed chart data.
								The original activity file will
								not be changed.
							</>
						) : (
							<>
								Tudo will process the original
								activity file again using the
								current ride parser.
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel
						disabled={processing}
					>
						Cancel
					</AlertDialogCancel>

					<AlertDialogAction
						disabled={
							processing ||
							!ride ||
							!ride.originalFilePath
						}
						onClick={(event) => {
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
								Re-analyze ride
							</>
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}