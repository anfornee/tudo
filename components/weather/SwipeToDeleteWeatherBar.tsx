"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WeatherBar } from "@/components/dashboard/WeatherBar";
import type { SavedWeatherLocation } from "@/lib/weather-location-types";

const DELETE_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD = 36;
const LONG_PRESS_DURATION = 550;

interface SwipeToDeleteWeatherBarProps {
  location: SavedWeatherLocation;
  removing: boolean;
  onRemove: () => void;
}

function displayName(location: SavedWeatherLocation) {
  return [location.name, location.region].filter(Boolean).join(", ");
}

export function SwipeToDeleteWeatherBar({
  location,
  removing,
  onRemove,
}: SwipeToDeleteWeatherBarProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    initialOffset: number;
    horizontal: boolean;
    longPressed: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const revealed = offset === -DELETE_ACTION_WIDTH;

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  useEffect(() => cancelLongPress, []);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("button, [role='combobox'], [data-weather-scroll]")) {
      return;
    }

    const touch = event.touches[0];
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialOffset: offset,
      horizontal: false,
      longPressed: false,
    };
    setDragging(true);

    longPressTimerRef.current = window.setTimeout(() => {
      if (!gestureRef.current) {
        return;
      }

      gestureRef.current.longPressed = true;
      suppressClickRef.current = true;
      setDragging(false);
      setOffset(-DELETE_ACTION_WIDTH);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DURATION);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const touch = event.touches[0];

    if (!gesture || !touch) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    if (Math.abs(deltaX) >= 8 || Math.abs(deltaY) >= 8) {
      cancelLongPress();
    }

    if (!gesture.horizontal) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        gestureRef.current = null;
        setDragging(false);
        return;
      }

      if (Math.abs(deltaX) < 8) {
        return;
      }

      gesture.horizontal = true;
    }

    event.preventDefault();
    suppressClickRef.current = true;
    setOffset(
      Math.min(0, Math.max(-DELETE_ACTION_WIDTH, gesture.initialOffset + deltaX)),
    );
  }

  function finishGesture() {
    const gesture = gestureRef.current;
    cancelLongPress();
    gestureRef.current = null;
    setDragging(false);

    if (gesture?.longPressed) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      return;
    }

    if (!gesture?.horizontal) {
      return;
    }

    setOffset(offset <= -SWIPE_THRESHOLD ? -DELETE_ACTION_WIDTH : 0);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-destructive">
      <button
        type="button"
        aria-label={`Remove ${displayName(location)}`}
        title={`Remove ${displayName(location)}`}
        disabled={removing}
        onFocus={() => setOffset(-DELETE_ACTION_WIDTH)}
        onClick={onRemove}
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center text-destructive-foreground hover:bg-destructive/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:opacity-60"
      >
        {removing ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <Trash2 className="size-6" />
        )}
      </button>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
        onContextMenu={(event) => {
          event.preventDefault();
          setOffset(-DELETE_ACTION_WIDTH);
        }}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          } else if (revealed) {
            event.preventDefault();
            event.stopPropagation();
            setOffset(0);
          }
        }}
        className={dragging ? "" : "transition-transform duration-200 ease-out"}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <WeatherBar
          coordinates={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          locationLabel={displayName(location)}
        />
      </div>
    </div>
  );
}
