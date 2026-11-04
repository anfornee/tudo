"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const buildId = process.env.NEXT_PUBLIC_TUDO_BUILD_ID;
const checkInterval = 5 * 60 * 1000;

export default function PwaRegister() {
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const reloadOnControl = useRef(false);
  const activationTimeout = useRef<number | undefined>(undefined);
  const [newBuild, setNewBuild] = useState(false);
  const [workerWaiting, setWorkerWaiting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);

  useEffect(() => {
    const workers = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    const controller = new AbortController();
    let installing: ServiceWorker | null = null;
    let checking = false;

    const checkWaiting = () => {
      setWorkerWaiting(Boolean(registration.current?.waiting && workers?.controller));
    };

    const watchInstalling = () => {
      installing?.removeEventListener("statechange", checkWaiting);
      installing = registration.current?.installing ?? null;
      installing?.addEventListener("statechange", checkWaiting);
      checkWaiting();
    };

    const onControllerChange = () => {
      if (reloadOnControl.current) {
        window.clearTimeout(activationTimeout.current);
        window.location.reload();
      } else {
        checkWaiting();
      }
    };

    const checkForUpdate = async () => {
      if (document.hidden || !navigator.onLine || checking) return;
      checking = true;

      try {
        await Promise.allSettled([
          registration.current?.update(),
          buildId && process.env.NODE_ENV === "production"
            ? fetch("/api/version", { cache: "no-store", signal: controller.signal })
                .then(async (response) => {
                  if (!response.ok) return;
                  const { version } = await response.json();
                  if (!controller.signal.aborted && typeof version === "string") {
                    setNewBuild(version !== buildId);
                  }
                })
            : undefined,
        ]);
      } finally {
        checking = false;
      }
    };

    workers?.addEventListener("controllerchange", onControllerChange);
    void workers?.register("/sw.js", { updateViaCache: "none" }).then((value) => {
      if (controller.signal.aborted) return;
      registration.current = value;
      value.addEventListener("updatefound", watchInstalling);
      watchInstalling();
    }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });

    void checkForUpdate();
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    const interval = window.setInterval(checkForUpdate, checkInterval);

    return () => {
      controller.abort();
      registration.current?.removeEventListener("updatefound", watchInstalling);
      installing?.removeEventListener("statechange", checkWaiting);
      workers?.removeEventListener("controllerchange", onControllerChange);
      registration.current = null;
      reloadOnControl.current = false;
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      window.clearInterval(interval);
      window.clearTimeout(activationTimeout.current);
    };
  }, []);

  function updateNow() {
    const waiting = registration.current?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }

    setUpdating(true);
    setUpdateFailed(false);
    reloadOnControl.current = true;
    activationTimeout.current = window.setTimeout(() => {
      reloadOnControl.current = false;
      setUpdating(false);
      setUpdateFailed(true);
    }, 10000);
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  if (!newBuild && !workerWaiting && !updating) return null;

  return (
    <aside
      aria-label="Tudo update"
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg"
    >
      <p role="status" className="text-sm">
        {updateFailed ? "Update timed out. Try again." : "A new version of Tudo is ready."}
      </p>
      <Button type="button" size="sm" onClick={updateNow} disabled={updating}>
        {updating ? "Updating…" : "Update now"}
      </Button>
    </aside>
  );
}
