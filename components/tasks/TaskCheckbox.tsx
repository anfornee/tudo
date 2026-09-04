"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskCheckbox({ checked, label, disabled, onChange, className }: { checked: boolean; label: string; disabled?: boolean; onChange: () => void; className?: string }) {
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange} className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/55 text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50", checked && "border-primary bg-primary", className)}>{checked && <Check className="size-4" strokeWidth={3} />}</button>;
}

