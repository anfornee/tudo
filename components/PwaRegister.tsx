"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });

        const checkForUpdate = () => {
          if (document.visibilityState === "visible" && navigator.onLine) {
            void registration.update();
          }
        };

        document.addEventListener("visibilitychange", checkForUpdate);
        window.addEventListener("online", checkForUpdate);

        return () => {
          document.removeEventListener("visibilitychange", checkForUpdate);
          window.removeEventListener("online", checkForUpdate);
        };
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    };

    let cleanup: (() => void) | undefined;
    let disposed = false;
    void registerServiceWorker().then((value) => {
      if (disposed) {
        value?.();
      } else {
        cleanup = value;
      }
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return null;
}
