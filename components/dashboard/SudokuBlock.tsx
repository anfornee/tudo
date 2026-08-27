import { ArrowRight, Grid3X3 } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

const preview = [
  5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6,
  0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0,
  0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0,
  0, 7, 9,
];

export function SudokuBlock() {
  return (
    <section className="flex min-h-[260px] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <Grid3X3 className="size-4 text-muted-foreground" />

        <h2 className="text-sm font-medium">Sudoku</h2>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-center gap-5">
          <div
            className="grid size-24 shrink-0 grid-cols-9 overflow-hidden rounded-md border border-foreground/30 bg-border"
            aria-hidden="true"
          >
            {preview.map((number, index) => {
              const row = Math.floor(index / 9);

              const column = index % 9;

              return (
                <div
                  key={index}
                  className={[
                    "flex items-center justify-center bg-background text-[7px] font-medium",
                    column !== 8 ? "border-r border-border" : "",
                    row !== 8 ? "border-b border-border" : "",
                    column === 2 || column === 5
                      ? "border-r-2 border-r-foreground/30"
                      : "",
                    row === 2 || row === 5
                      ? "border-b-2 border-b-foreground/30"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {number || ""}
                </div>
              );
            })}
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
