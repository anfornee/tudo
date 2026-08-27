"use client";

interface SudokuBoardProps {
  values: number[];
  puzzle: number[];
  solution: number[];
  notes: number[][];
  selectedIndex: number | null;
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
  onSelect,
}: SudokuBoardProps) {
  const selectedValue = selectedIndex !== null ? values[selectedIndex] : 0;

  return (
    <div
      className="grid aspect-square w-full grid-cols-9 overflow-hidden rounded-lg border-2 border-foreground/70 bg-border"
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
          !isGiven && value !== 0 && "font-semibold text-primary brightness-125";

        const hasRightBoxBorder = column === 2 || column === 5;

        const hasBottomBoxBorder = row === 2 || row === 5;

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
              "relative flex aspect-square min-w-0 items-center justify-center bg-background text-lg transition-colors sm:text-xl md:text-2xl",
              "focus:z-10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
              column !== 8 && "border-r border-border",
              row !== 8 && "border-b border-border",
              hasRightBoxBorder && "border-r-2 border-r-foreground/70",
              hasBottomBoxBorder && "border-b-2 border-b-foreground/70",
              isRelated && !isSelected && "bg-muted/60",
              isMatching && !isSelected && "bg-accent",
              isSelected && "bg-primary/15",
              isGiven && "font-semibold",
              !isGiven && value !== 0 && "text-primary",
              isIncorrect && "text-destructive",
            )}
          >
            {value !== 0 ? (
              <span>{value}</span>
            ) : (
              <div className="grid size-full grid-cols-3 grid-rows-3 p-[2px] sm:p-1">
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
    </div>
  );
}
