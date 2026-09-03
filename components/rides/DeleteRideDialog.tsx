"use client";

import { Loader2 } from "lucide-react";

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

interface DeleteRideDialogProps {
    ride: SavedRide | null;
    open: boolean;
    deleting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

function rideDate(ride: SavedRide) {
    return (ride.activityDate ?? ride.importedAt)?.toDate() ?? null;
}

export function DeleteRideDialog({
    ride,
    open,
    deleting,
    onOpenChange,
    onConfirm,
}: DeleteRideDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete this ride?</AlertDialogTitle>

                    <AlertDialogDescription>
                        {ride ? (
                            <>
                                This will permanently delete the ride from{" "}
                                {rideDate(ride)?.toLocaleDateString() ?? "an unknown date"}
                                {ride.originalFileName ? (
                                    <>
                                        {" "}
                                        (<span className="font-medium">{ride.originalFileName}</span>)
                                    </>
                                ) : null}
                                , including its stored activity data and original source file.
                                This action cannot be undone.
                            </>
                        ) : (
                            <>
                                This will permanently delete the ride and its stored activity
                                data. This action cannot be undone.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>
                        Cancel
                    </AlertDialogCancel>

                    <AlertDialogAction
                        disabled={deleting || !ride}
                        onClick={(event) => {
                            event.preventDefault();
                            onConfirm();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {deleting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            "Delete ride"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}