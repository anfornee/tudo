"use client";

import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RideBlock } from "@/components/dashboard/RideBlock";
import { SudokuBlock } from "@/components/dashboard/SudokuBlock";
import { WeatherBar } from "@/components/dashboard/WeatherBar";
import { useFeatureOrder } from "@/components/feature-order-provider";
import {
  moveFeature,
  type DashboardFeatureId,
} from "@/lib/feature-order";
import { appFeatures } from "@/lib/features";
import { cn } from "@/lib/utils";

const dashboardLabels = new Map(
  appFeatures.map((feature) => [feature.id, feature.label]),
);

function ordersMatch(
  first: readonly DashboardFeatureId[],
  second: readonly DashboardFeatureId[],
) {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

export function DashboardFeatureGrid() {
  const {
    dashboardOrder: featureOrder,
    preferencesLoaded,
    preferenceError,
    updateDashboardOrder,
    persistFeatureOrder,
    clearPreferenceError,
  } = useFeatureOrder();
  const [activeFeatureId, setActiveFeatureId] =
    useState<DashboardFeatureId | null>(null);
  const [keyboardDragging, setKeyboardDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const featureOrderRef = useRef(featureOrder);
  const startingOrderRef = useRef<DashboardFeatureId[]>(featureOrder);
  const activeFeatureRef = useRef<DashboardFeatureId | null>(null);

  function updateOrder(nextOrder: DashboardFeatureId[]) {
    featureOrderRef.current = nextOrder;
    updateDashboardOrder(nextOrder);
  }

  useEffect(() => {
    featureOrderRef.current = featureOrder;
  }, [featureOrder]);

  function announcePosition(featureId: DashboardFeatureId) {
    const position = featureOrderRef.current.indexOf(featureId) + 1;
    setAnnouncement(
      `${dashboardLabels.get(featureId)} moved to position ${position} of ${featureOrderRef.current.length}.`,
    );
  }

  function beginDrag(featureId: DashboardFeatureId) {
    startingOrderRef.current = [...featureOrderRef.current];
    activeFeatureRef.current = featureId;
    setActiveFeatureId(featureId);
    clearPreferenceError();
  }

  function finishDrag(featureId: DashboardFeatureId) {
    const nextOrder = featureOrderRef.current;
    activeFeatureRef.current = null;
    setActiveFeatureId(null);
    setKeyboardDragging(false);
    announcePosition(featureId);

    if (!ordersMatch(startingOrderRef.current, nextOrder)) {
      void persistFeatureOrder();
    }
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLButtonElement>,
    featureId: DashboardFeatureId,
  ) {
    if (activeFeatureRef.current !== featureId || keyboardDragging) return;

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-dashboard-feature-id]");
    const targetId = target?.dataset.dashboardFeatureId as
      | DashboardFeatureId
      | undefined;

    if (!targetId || targetId === featureId) return;
    const targetIndex = featureOrderRef.current.indexOf(targetId);
    if (targetIndex !== -1) {
      updateOrder(moveFeature(featureOrderRef.current, featureId, targetIndex));
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    featureId: DashboardFeatureId,
  ) {
    if (!keyboardDragging || activeFeatureId !== featureId) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        beginDrag(featureId);
        setKeyboardDragging(true);
        setAnnouncement(
          `${dashboardLabels.get(featureId)} picked up. Use arrow keys to move it, then press Enter or Space to save.`,
        );
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      updateOrder(startingOrderRef.current);
      activeFeatureRef.current = null;
      setActiveFeatureId(null);
      setKeyboardDragging(false);
      setAnnouncement("Dashboard reorder canceled.");
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      finishDrag(featureId);
      return;
    }

    const currentIndex = featureOrderRef.current.indexOf(featureId);
    let targetIndex = currentIndex;

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") targetIndex -= 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") targetIndex += 1;
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = featureOrderRef.current.length - 1;

    if (targetIndex !== currentIndex) {
      event.preventDefault();
      updateOrder(moveFeature(featureOrderRef.current, featureId, targetIndex));
      announcePosition(featureId);
    }
  }

  if (!preferencesLoaded) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading dashboard order">
        <div className="h-48 animate-pulse rounded-xl bg-muted md:col-span-2 lg:col-span-3" />
        <div className="h-[260px] animate-pulse rounded-xl bg-muted" />
        <div className="h-[260px] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <>
      {preferenceError && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Dashboard preferences are unavailable. The current layout remains usable,
          but this order may not persist.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {featureOrder.map((featureId) => {
          const active = activeFeatureId === featureId;
          const dragHandle = (
            <button
              type="button"
              aria-label={`Reorder ${dashboardLabels.get(featureId)}`}
              aria-pressed={active}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                beginDrag(featureId);
              }}
              onPointerMove={(event) => handlePointerMove(event, featureId)}
              onPointerUp={(event) => {
                if (activeFeatureRef.current !== featureId || keyboardDragging) return;
                event.currentTarget.releasePointerCapture(event.pointerId);
                finishDrag(featureId);
              }}
              onPointerCancel={() => {
                if (activeFeatureRef.current !== featureId || keyboardDragging) return;
                updateOrder(startingOrderRef.current);
                activeFeatureRef.current = null;
                setActiveFeatureId(null);
              }}
              onKeyDown={(event) => handleKeyDown(event, featureId)}
              className={cn(
                "touch-none rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "cursor-grabbing bg-muted text-foreground" : "cursor-grab",
              )}
            >
              <GripVertical className="size-5" />
            </button>
          );

          return (
            <div
              key={featureId}
              data-dashboard-feature-id={featureId}
              className={cn(
                "min-w-0",
                featureId === "weather" && "md:col-span-2 lg:col-span-3",
              )}
            >
              <div
                className={cn(
                  "rounded-xl motion-safe:transition-[opacity,box-shadow]",
                  active && "opacity-75 ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {featureId === "weather" && (
                  <WeatherBar linkToWeatherPage dragHandle={dragHandle} />
                )}
                {featureId === "sudoku" && (
                  <SudokuBlock dragHandle={dragHandle} />
                )}
                {featureId === "rides" && (
                  <RideBlock dragHandle={dragHandle} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>
    </>
  );
}
