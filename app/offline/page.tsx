import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/icons/tudo-logo-transparent.png"
          alt=""
          width={80}
          height={80}
          className="mx-auto size-20 object-contain"
          priority
          unoptimized
        />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tudo needs a connection for this screen. Your locally saved progress
          is still on this device.
        </p>
        <Link
          href="/"
          className={buttonVariants({ className: "mt-6 min-h-11 w-full" })}
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
