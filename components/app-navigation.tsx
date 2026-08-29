"use client";

import { Home, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppMenu } from "@/components/app-menu";
import { auth } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [isMenuTriggerSpinning, setIsMenuTriggerSpinning] = useState(false);
  const menuTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeMenu = useCallback(() => {
    if (closeTimerRef.current !== null) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsMenuOpen(false);
      window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
      return;
    }

    setIsMenuClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsMenuOpen(false);
      setIsMenuClosing(false);
      closeTimerRef.current = null;
      window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }, 300);
  }, []);
  const homeIsActive = isActiveRoute(pathname, "/dashboard");

  function openMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (isMenuOpen || isMenuTriggerSpinning) {
      return;
    }

    menuTriggerRef.current = event.currentTarget;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsMenuOpen(true);
      return;
    }

    setIsMenuTriggerSpinning(true);
    menuTimerRef.current = window.setTimeout(() => {
      setIsMenuTriggerSpinning(false);
      setIsMenuOpen(true);
      menuTimerRef.current = null;
    }, 350);
  }

  useEffect(() => {
    return () => {
      if (menuTimerRef.current !== null) {
        window.clearTimeout(menuTimerRef.current);
      }

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await auth.signOut();
    } finally {
      window.location.assign("/api/auth/logout");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:block">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            aria-current={homeIsActive ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              homeIsActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Home className="size-4" />
            Home
          </Link>

          <button
            type="button"
            aria-label="Open pages menu"
            aria-expanded={isMenuOpen}
            onClick={openMenu}
            className="group flex size-11 items-center justify-center rounded-full transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image
              src="/icons/tudo-logo-transparent.png"
              alt=""
              width={40}
              height={40}
              className={cn(
                "size-10 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]",
                isMenuTriggerSpinning && "animate-spin [animation-duration:350ms] [animation-iteration-count:1]",
              )}
            />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <LogOut className="size-4" />
            {isLoggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </header>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:hidden"
      >
        <ul className="mx-auto flex max-w-md px-3">
          <li className="flex-1">
            <Link
              href="/dashboard"
              aria-current={homeIsActive ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                homeIsActive
                  ? "text-primary"
                  : "text-muted-foreground active:bg-muted",
              )}
            >
              <Home className="size-5" strokeWidth={homeIsActive ? 2.5 : 2} />
              Home
            </Link>
          </li>
          <li className="flex-1">
            <button
              type="button"
              aria-label="Open pages menu"
              aria-expanded={isMenuOpen}
              onClick={openMenu}
              className="flex min-h-12 w-full items-center justify-center rounded-xl px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
            >
              <Image
                src="/icons/tudo-logo-transparent.png"
                alt=""
                width={38}
                height={38}
                className={cn(
                  "size-9 object-contain drop-shadow-[0_0_6px_rgba(34,211,238,0.45)]",
                  isMenuTriggerSpinning && "animate-spin [animation-duration:350ms] [animation-iteration-count:1]",
                )}
              />
            </button>
          </li>
          <li className="flex-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <LogOut className="size-5" />
              {isLoggingOut ? "Leaving…" : "Log out"}
            </button>
          </li>
        </ul>
      </nav>

      {isMenuOpen && (
        <AppMenu
          pathname={pathname}
          isClosing={isMenuClosing}
          onClose={closeMenu}
        />
      )}
    </>
  );
}
