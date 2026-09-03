"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryColors, categoryLabels } from "@/components/bills/BillMetadata";
import { billCategories, type BillInput } from "@/lib/bills/types";

export const emptyBillInput: BillInput = { name: "", amount: 0, dueDay: 1, category: "other", isAutopay: false, isSubscription: false, notificationsEnabled: true, isActive: true };

export function BillForm({ initialValue = emptyBillInput, submitLabel = "Save bill", busy = false, onSubmit }: { initialValue?: BillInput; submitLabel?: string; busy?: boolean; onSubmit: (value: BillInput) => Promise<void> }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.name.trim()) return setError("Enter a bill name.");
    if (!Number.isFinite(value.amount) || value.amount <= 0) return setError("Enter an amount greater than zero.");
    if (!Number.isInteger(value.dueDay) || value.dueDay < 1 || value.dueDay > 31) return setError("Due day must be between 1 and 31.");
    setError(null);
    await onSubmit({ ...value, name: value.name.trim() });
  }
  return <form onSubmit={submit} className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor="bill-name">Name</Label><Input id="bill-name" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} autoComplete="off" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5"><Label htmlFor="bill-amount">Amount</Label><Input id="bill-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={value.amount || ""} onChange={(e) => setValue({ ...value, amount: Number(e.target.value) })} /></div>
      <div className="space-y-1.5"><Label htmlFor="bill-day">Due day</Label><Input id="bill-day" type="number" inputMode="numeric" min="1" max="31" value={value.dueDay} onChange={(e) => setValue({ ...value, dueDay: Number(e.target.value) })} /></div>
    </div>
    <div className="space-y-1.5"><Label>Category</Label><Select value={value.category} onValueChange={(category) => category && setValue({ ...value, category })}><SelectTrigger className="w-full" aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>{billCategories.map((category) => <SelectItem key={category} value={category} className={categoryColors[category]}>{categoryLabels[category]}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2 rounded-xl bg-muted/40 p-3">
      {([ ["isAutopay", "Autopay"], ["isSubscription", "Subscription"], ["notificationsEnabled", "Bill reminders"] ] as const).map(([key, label]) => <label key={key} className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" className="size-5 accent-primary" checked={value[key]} onChange={(e) => setValue({ ...value, [key]: e.target.checked })} /></label>)}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="animate-spin" />}{submitLabel}</Button>
  </form>;
}
