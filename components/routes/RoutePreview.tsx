import { MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoutePreview({ path, className, label = "Route map preview" }: {
  path: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} role="img" aria-label={label}>
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
      {path ? (
        <svg className="relative size-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d={path} fill="none" stroke="#e44d2e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="relative flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <MapPinned className="size-6" />
          <span className="text-xs">Preview available after next save</span>
        </div>
      )}
    </div>
  );
}
