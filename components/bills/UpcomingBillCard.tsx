"use client";

import { ChevronLeft, ChevronRight, Loader2, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BillMetadata } from "@/components/bills/BillMetadata";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase-client";
import { getBills } from "@/lib/bills/persistence";
import type { Bill } from "@/lib/bills/types";
import { formatCurrency, formatDueRelative, getNextBillOccurrence, sortBillsByUpcomingOccurrence } from "@/lib/bills/utils";

export function UpcomingBillCard({ userId, bills: suppliedBills, loading: suppliedLoading, dragHandle, linkToBillsPage = false }: { userId?: string; bills?: Bill[]; loading?: boolean; dragHandle?: React.ReactNode; linkToBillsPage?: boolean }) {
  const router = useRouter();
  const [loadedBills, setLoadedBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(suppliedBills === undefined);
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  useEffect(() => {
    if (suppliedBills !== undefined) return;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user || (userId && user.uid !== userId)) return;
      void getBills(user.uid).then(setLoadedBills).finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [suppliedBills, userId]);
  const bills = suppliedBills ?? loadedBills;
  const ordered = useMemo(() => sortBillsByUpcomingOccurrence(bills), [bills]);
  const safeIndex = Math.min(index, Math.max(ordered.length - 1, 0));
  const bill = ordered[safeIndex];
  const occurrence = bill ? getNextBillOccurrence(bill.dueDay) : null;
  const sameDayCount = occurrence ? ordered.filter((item) => getNextBillOccurrence(item.dueDay).getTime() === occurrence.getTime()).length - 1 : 0;
  function move(direction: number) { setIndex(Math.max(0, Math.min(ordered.length - 1, safeIndex + direction))); }
  return <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b px-5 py-3"><div className="flex items-center gap-2"><ReceiptText className="size-4 text-muted-foreground" /><h2 className="text-sm font-medium">Upcoming bill</h2></div><div className="flex items-center gap-1">{ordered.length > 1 && <span className="mr-1 text-xs text-muted-foreground">{safeIndex + 1} of {ordered.length}</span>}{dragHandle}</div></div>
    <div
      role={linkToBillsPage ? "link" : undefined}
      tabIndex={linkToBillsPage ? 0 : undefined}
      className={`min-h-36 touch-pan-y px-5 py-4 ${linkToBillsPage ? "cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" : ""}`}
      onClick={() => {
        if (didSwipe.current) { didSwipe.current = false; return; }
        if (linkToBillsPage) router.push("/bills");
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && linkToBillsPage && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          router.push("/bills");
        }
      }}
      onPointerDown={(event) => { startX.current = event.clientX; didSwipe.current = false; }}
      onPointerUp={(event) => {
        if (startX.current === null) return;
        const delta = event.clientX - startX.current;
        if (Math.abs(delta) > 45) { didSwipe.current = true; move(delta < 0 ? 1 : -1); }
        startX.current = null;
      }}
    >
      {(suppliedLoading ?? loading) ? <div className="flex min-h-28 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : !bill || !occurrence ? <div className="flex min-h-28 flex-col items-center justify-center text-center"><p className="font-medium">No bills added yet</p><p className="mt-1 text-sm text-muted-foreground">Add a monthly bill to see what is next.</p></div> : <div className="flex min-h-28 items-center justify-between gap-4">
        <Button variant="ghost" size="icon-sm" aria-label="Previous bill" disabled={safeIndex === 0} onClick={(event) => { event.stopPropagation(); move(-1); }}><ChevronLeft /></Button>
        <div className="min-w-0 flex-1 text-center"><p className="truncate text-lg font-semibold">{bill.name}</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(bill.amount)}</p><p className="mt-1 text-sm text-muted-foreground">{formatDueRelative(occurrence)}</p><div className="mt-2 flex justify-center"><BillMetadata bill={bill} /></div>{sameDayCount > 0 && <p className="mt-2 text-xs text-muted-foreground">+{sameDayCount} more due that day</p>}</div>
        <Button variant="ghost" size="icon-sm" aria-label="Next bill" disabled={safeIndex === ordered.length - 1} onClick={(event) => { event.stopPropagation(); move(1); }}><ChevronRight /></Button>
      </div>}
    </div>
  </section>;
}
