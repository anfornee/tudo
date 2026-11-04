"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";

import {
  refreshServerSession,
  sessionRefreshIsDue,
} from "@/lib/auth-session-client";
import {
  notificationRegistrationRefreshIsDue,
  refreshBillNotificationRegistration,
} from "@/lib/bills/notifications";
import { auth } from "@/lib/firebase-client";

export function PwaRuntime({ userId }: { userId: string }) {
  const maintenanceInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const maintain = () => {
      const user = auth.currentUser;

      if (!user || user.uid !== userId || maintenanceInFlight.current) {
        return;
      }

      const maintenanceTasks: Promise<unknown>[] = [];

      if (sessionRefreshIsDue()) {
        maintenanceTasks.push(refreshServerSession(user));
      }

      if (notificationRegistrationRefreshIsDue()) {
        maintenanceTasks.push(refreshBillNotificationRegistration(userId));
      }

      maintenanceInFlight.current = Promise.all(maintenanceTasks)
        .then(() => undefined)
        .catch((error) => {
          console.error("PWA maintenance failed:", error);
        })
        .finally(() => {
          maintenanceInFlight.current = null;
        });
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.uid === userId) {
        maintain();
      }
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        maintain();
      }
    };

    window.addEventListener("online", maintain);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const maintenanceTimer = window.setInterval(maintain, 6 * 60 * 60 * 1000);

    return () => {
      unsubscribe();
      window.removeEventListener("online", maintain);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(maintenanceTimer);
    };
  }, [userId]);

  return null;
}
