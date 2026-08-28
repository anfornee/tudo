"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { appFeatures } from "@/lib/features";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard",
    icon: Home,
  },
  ...appFeatures.filter((feature) => feature.showInNav),
];

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:block">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <nav aria-label="Primary navigation" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {navigationItems.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                const Icon = item.icon;

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-3 px-3">
          {navigationItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "text-primary"
                      : "text-muted-foreground active:bg-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
