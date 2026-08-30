"use client";

interface SudokuBoardProps {
  values: number[];
  puzzle: number[];
  solution: number[];
  notes: number[][];
  selectedIndex: number | null;
  completed: boolean;
  onSelect: (index: number) => void;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isSameGroup(firstIndex: number, secondIndex: number): boolean {
  const firstRow = Math.floor(firstIndex / 9);
  const firstColumn = firstIndex % 9;

  const secondRow = Math.floor(secondIndex / 9);
  const secondColumn = secondIndex % 9;

  const sameRow = firstRow === secondRow;
  const sameColumn = firstColumn === secondColumn;

  const sameBox =
    Math.floor(firstRow / 3) === Math.floor(secondRow / 3) &&
    Math.floor(firstColumn / 3) === Math.floor(secondColumn / 3);

  return sameRow || sameColumn || sameBox;
}

export function SudokuBoard({
  values,
  puzzle,
  solution,
  notes,
  selectedIndex,
  completed,
  onSelect,
}: SudokuBoardProps) {
  const selectedValue = selectedIndex !== null ? values[selectedIndex] : 0;

  return (
    <div
      className="relative grid w-full grid-cols-[repeat(9,minmax(0,1fr))] overflow-hidden rounded-lg border-2 border-foreground/70 bg-border"
      role="grid"
      aria-label="Sudoku board"
    >
      {values.map((value, index) => {
        const row = Math.floor(index / 9);
        const column = index % 9;

        const isGiven = puzzle[index] !== 0;
        const isSelected = selectedIndex === index;

        const isRelated =
          selectedIndex !== null && isSameGroup(selectedIndex, index);

        const isMatching = selectedValue !== 0 && value === selectedValue;

        const isIncorrect =
          !isGiven && value !== 0 && value !== solution[index];

        return (
          <button
            key={index}
            type="button"
            role="gridcell"
            aria-label={`Row ${row + 1}, column ${column + 1}${
              value ? `, value ${value}` : ", empty"
            }`}
            aria-selected={isSelected}
            onClick={() => onSelect(index)}
            className={classNames(
              "relative flex aspect-square min-w-0 overflow-hidden items-center justify-center bg-background text-lg transition-colors sm:text-xl md:text-2xl",
              "focus:z-10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
              column !== 8 && "border-r border-border",
              row !== 8 && "border-b border-border",
              isRelated && !isSelected && "bg-muted/60",
              isMatching && !isSelected && "bg-accent",
              isSelected && "bg-primary/15",
            )}
          >
            {completed && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 animate-in bg-primary/20 fade-in-0 duration-500 motion-reduce:animate-none"
                style={{ animationDelay: `${(row + column) * 45}ms` }}
              />
            )}

            {value !== 0 ? (
              <span
                className={classNames(
                  "relative font-semibold",
                  isGiven && "text-foreground",
                  !isGiven && !isIncorrect && "!text-sky-300",
                  isIncorrect && "!text-red-500",
                )}
              >
                {value}
              </span>
            ) : (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[2px] sm:p-1">
                {Array.from({ length: 9 }, (_, noteIndex) => {
                  const number = noteIndex + 1;

                  const visible = notes[index]?.includes(number);

                  return (
                    <span
                      key={number}
                      className="flex items-center justify-center text-[7px] font-medium leading-none text-muted-foreground sm:text-[9px] md:text-[10px]"
                    >
                      {visible ? number : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20"
      >
        <span className="absolute inset-y-0 left-1/3 w-0.5 -translate-x-1/2 bg-foreground/70" />
        <span className="absolute inset-y-0 left-2/3 w-0.5 -translate-x-1/2 bg-foreground/70" />
        <span className="absolute inset-x-0 top-1/3 h-0.5 -translate-y-1/2 bg-foreground/70" />
        <span className="absolute inset-x-0 top-2/3 h-0.5 -translate-y-1/2 bg-foreground/70" />
      </div>
    </div>
  );
}
