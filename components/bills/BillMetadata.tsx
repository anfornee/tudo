import { BookOpen, Car, Clapperboard, CreditCard, Dumbbell, HeartPulse, Home, Landmark, PlugZap, RefreshCw, ShieldCheck, Shapes } from "lucide-react";
import type { Bill, BillCategory } from "@/lib/bills/types";

export const categoryLabels: Record<BillCategory, string> = {
  housing: "Housing", utilities: "Utilities", transportation: "Transportation",
  insurance: "Insurance", debt: "Debt", entertainment: "Entertainment",
  fitness: "Fitness", health: "Health", education: "Education", other: "Other",
};

const categoryIcons = {
  housing: Home, utilities: PlugZap, transportation: Car, insurance: ShieldCheck,
  debt: Landmark, entertainment: Clapperboard, fitness: Dumbbell,
  health: HeartPulse, education: BookOpen, other: Shapes,
} satisfies Record<BillCategory, typeof Home>;

export const categoryColors: Record<BillCategory, string> = {
  housing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  utilities: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  transportation: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  insurance: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  debt: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  entertainment: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  fitness: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  health: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  education: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  other: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export const subscriptionColor = "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300";
export const autopayColor = "bg-teal-500/15 text-teal-700 dark:text-teal-300";

function Indicator({ label, children, expanded = false, className = "bg-muted text-muted-foreground" }: { label: string; children: React.ReactNode; expanded?: boolean; className?: string }) {
  return <span title={label} aria-label={label} className={`inline-flex items-center justify-center gap-1.5 rounded-full ${className} ${expanded ? "h-7 px-2.5 text-xs font-medium" : "size-6"}`}>{children}{expanded && label}</span>;
}

export function BillMetadata({ bill, expanded = false }: { bill: Pick<Bill, "category" | "isAutopay" | "isSubscription">; expanded?: boolean }) {
  const CategoryIcon = categoryIcons[bill.category];
  return <div className="flex flex-wrap items-center gap-1.5">
    <Indicator label={categoryLabels[bill.category]} expanded={expanded} className={categoryColors[bill.category]}><CategoryIcon className="size-3.5" /></Indicator>
    {bill.isAutopay && <Indicator label="Autopay" expanded={expanded} className={autopayColor}><RefreshCw className="size-3.5" /></Indicator>}
    {bill.isSubscription && <Indicator label="Subscription" expanded={expanded} className={subscriptionColor}><CreditCard className="size-3.5" /></Indicator>}
  </div>;
}
