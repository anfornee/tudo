import { ArrowRight, Grid3X3 } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

const preview = [
  5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6,
  0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0,
  0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0,
  0, 7, 9,
];

export function SudokuBlock({ dragHandle }: { dragHandle?: React.ReactNode }) {
  return (
    <section className="flex min-h-[260px] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Grid3X3 className="size-4 text-muted-foreground" />

          <h2 className="text-sm font-medium">Sudoku</h2>
        </div>

        {dragHandle}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-center gap-5">
          <div
            className="relative grid size-24 shrink-0 grid-cols-9 grid-rows-[repeat(9,minmax(0,1fr))] overflow-hidden rounded-md border border-foreground/30 bg-border"
            aria-hidden="true"
          >
            {preview.map((number, index) => {
              const row = Math.floor(index / 9);

              const column = index % 9;

              return (
                <div
                  key={index}
                  className={[
                    "flex min-h-0 items-center justify-center bg-background text-[7px] leading-none font-medium",
                    column !== 8 ? "border-r border-border" : "",
                    row !== 8 ? "border-b border-border" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {number || ""}
                </div>
              );
            })}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10"
            >
              <span className="absolute inset-y-0 left-1/3 w-px -translate-x-1/2 bg-foreground/40" />
              <span className="absolute inset-y-0 left-2/3 w-px -translate-x-1/2 bg-foreground/40" />
              <span className="absolute inset-x-0 top-1/3 h-px -translate-y-1/2 bg-foreground/40" />
              <span className="absolute inset-x-0 top-2/3 h-px -translate-y-1/2 bg-foreground/40" />
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold">Quick brain break</h3>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Choose easy, medium or hard and see how quickly you can finish.
            </p>
          </div>
        </div>

        <div className="mt-auto">
          <Link
            href="/sudoku"
            className={buttonVariants({
              variant: "default",
              className: "w-full",
            })}
          >
            Play Sudoku
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
