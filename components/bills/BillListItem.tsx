import Link from "next/link";
import { BillMetadata } from "@/components/bills/BillMetadata";
import type { Bill } from "@/lib/bills/types";
import { formatCurrency, formatOrdinalDay } from "@/lib/bills/utils";

export function BillListItem({ bill }: { bill: Bill }) {
  return <Link href={`/bills/${bill.id}`} className="grid min-h-16 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className="text-sm font-medium text-muted-foreground">{formatOrdinalDay(bill.dueDay)}</span>
    <span className="min-w-0"><span className="block truncate font-medium">{bill.name}</span><span className="mt-1 block"><BillMetadata bill={bill} /></span></span>
    <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(bill.amount)}</span>
  </Link>;
}
