"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { appFeatures } from "@/lib/features";
import { cn } from "@/lib/utils";

interface AppMenuProps {
  pathname: string;
  isClosing: boolean;
  onClose: () => void;
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppMenu({ pathname, isClosing, onClose }: AppMenuProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="app-menu-title">
      <button
        type="button"
        aria-label="Close pages menu"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/45 backdrop-blur-[2px] duration-200",
          isClosing
            ? "animate-out fade-out-0 fill-mode-forwards"
            : "animate-in fade-in-0",
        )}
      />

      <section
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[min(75dvh,42rem)] flex-col rounded-t-3xl border-t bg-background shadow-2xl duration-300 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-[min(26rem,90vw)] sm:rounded-none sm:rounded-l-3xl sm:border-t-0 sm:border-l",
          isClosing
            ? "animate-out slide-out-to-bottom fill-mode-forwards sm:slide-out-to-right sm:[--tw-exit-translate-y:0]"
            : "animate-in slide-in-from-bottom sm:slide-in-from-right sm:[--tw-enter-translate-y:0]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-6">
          <div>
            <h2 id="app-menu-title" className="text-lg font-semibold">
              Pages
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose where you want to go.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close pages menu"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Application pages"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5"
        >
          <ul className="grid gap-2">
            {appFeatures
              .filter((feature) => feature.showInNav)
              .map((feature) => {
                const active = isActiveRoute(pathname, feature.href);
                const Icon = feature.icon;

                return (
                  <li key={feature.id}>
                    <Link
                      href={feature.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onClose}
                      className={cn(
                        "flex min-h-16 items-center gap-4 rounded-2xl border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/70 bg-card hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          active ? "bg-primary/15" : "bg-muted",
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="font-medium">{feature.label}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>
      </section>
    </div>
  );
}
