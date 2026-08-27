"use client";

import {
  Clock3,
  Eraser,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DIFFICULTY_CONFIG, generateSudoku } from "@/lib/sudoku/generator";
import type { SudokuDifficulty, SudokuPuzzle } from "@/lib/sudoku/types";

import { SudokuBoard } from "./SudokuBoard";

const EMPTY_NOTES = () => Array.from({ length: 81 }, () => [] as number[]);

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function difficultyLabel(difficulty: SudokuDifficulty): string {
  return DIFFICULTY_CONFIG[difficulty].label;
}

function getPeerIndexes(index: number): number[] {
  const peers = new Set<number>();

  const row = Math.floor(index / 9);
  const column = index % 9;

  for (let currentColumn = 0; currentColumn < 9; currentColumn += 1) {
    peers.add(row * 9 + currentColumn);
  }

  for (let currentRow = 0; currentRow < 9; currentRow += 1) {
    peers.add(currentRow * 9 + column);
  }

  const boxStartRow = Math.floor(row / 3) * 3;
  const boxStartColumn = Math.floor(column / 3) * 3;

  for (
    let currentRow = boxStartRow;
    currentRow < boxStartRow + 3;
    currentRow += 1
  ) {
    for (
      let currentColumn = boxStartColumn;
      currentColumn < boxStartColumn + 3;
      currentColumn += 1
    ) {
      peers.add(currentRow * 9 + currentColumn);
    }
  }

  peers.delete(index);

  return [...peers];
}

export function SudokuGame() {
  const [game, setGame] = useState<SudokuPuzzle | null>(null);

  const [values, setValues] = useState<number[]>([]);
  const [notes, setNotes] = useState<number[][]>(EMPTY_NOTES);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [notesMode, setNotesMode] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [generating, setGenerating] = useState(false);

  const gameAreaRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback((difficulty: SudokuDifficulty) => {
    setGenerating(true);

    /*
     * Let React paint the loading state before puzzle generation
     * begins on the main thread.
     */
    window.setTimeout(() => {
      const nextGame = generateSudoku(difficulty);

      setGame(nextGame);
      setValues([...nextGame.puzzle]);
      setNotes(EMPTY_NOTES());
      setSelectedIndex(null);
      setNotesMode(false);
      setElapsedSeconds(0);
      setCompleted(false);
      setGenerating(false);

      window.requestAnimationFrame(() => {
        gameAreaRef.current?.focus();
      });
    }, 0);
  }, []);

  const restartGame = useCallback(() => {
    if (!game) {
      return;
    }

    setValues([...game.puzzle]);
    setNotes(EMPTY_NOTES());
    setSelectedIndex(null);
    setNotesMode(false);
    setElapsedSeconds(0);
    setCompleted(false);

    window.requestAnimationFrame(() => {
      gameAreaRef.current?.focus();
    });
  }, [game]);

  useEffect(() => {
    if (!game || completed) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [game, completed]);

  const isSolved = useCallback(
    (nextValues: number[]) => {
      if (!game) {
        return false;
      }

      return nextValues.every((value, index) => value === game.solution[index]);
    },
    [game],
  );

  const enterNumber = useCallback(
    (number: number) => {
      if (!game || selectedIndex === null || completed) {
        return;
      }

      if (game.puzzle[selectedIndex] !== 0) {
        return;
      }

      if (notesMode) {
        if (values[selectedIndex] !== 0) {
          return;
        }

        setNotes((currentNotes) => {
          const nextNotes = currentNotes.map((cellNotes) => [...cellNotes]);

          const currentCellNotes = nextNotes[selectedIndex];

          if (currentCellNotes.includes(number)) {
            nextNotes[selectedIndex] = currentCellNotes.filter(
              (note) => note !== number,
            );
          } else {
            nextNotes[selectedIndex] = [...currentCellNotes, number].sort();
          }

          return nextNotes;
        });

        return;
      }

      setValues((currentValues) => {
        const nextValues = [...currentValues];

        nextValues[selectedIndex] = number;

        if (isSolved(nextValues)) {
          setCompleted(true);
        }

        return nextValues;
      });

      setNotes((currentNotes) => {
        const nextNotes = currentNotes.map((cellNotes) => [...cellNotes]);

        nextNotes[selectedIndex] = [];

        for (const peerIndex of getPeerIndexes(selectedIndex)) {
          nextNotes[peerIndex] = nextNotes[peerIndex].filter(
            (note) => note !== number,
          );
        }

        return nextNotes;
      });
    },
    [completed, game, isSolved, notesMode, selectedIndex, values],
  );

  const eraseSelected = useCallback(() => {
    if (!game || selectedIndex === null || completed) {
      return;
    }

    if (game.puzzle[selectedIndex] !== 0) {
      return;
    }

    setValues((currentValues) => {
      const nextValues = [...currentValues];

      nextValues[selectedIndex] = 0;

      return nextValues;
    });

    setNotes((currentNotes) => {
      const nextNotes = currentNotes.map((cellNotes) => [...cellNotes]);

      nextNotes[selectedIndex] = [];

      return nextNotes;
    });
  }, [completed, game, selectedIndex]);

  const moveSelection = useCallback(
    (rowDelta: number, columnDelta: number) => {
      const currentIndex = selectedIndex ?? 0;

      const currentRow = Math.floor(currentIndex / 9);

      const currentColumn = currentIndex % 9;

      const nextRow = Math.min(8, Math.max(0, currentRow + rowDelta));

      const nextColumn = Math.min(8, Math.max(0, currentColumn + columnDelta));

      setSelectedIndex(nextRow * 9 + nextColumn);
    },
    [selectedIndex],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;

      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        enterNumber(Number(event.key));
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        eraseSelected();
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNotesMode((current) => !current);
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveSelection(-1, 0);
          break;

        case "ArrowDown":
          event.preventDefault();
          moveSelection(1, 0);
          break;

        case "ArrowLeft":
          event.preventDefault();
          moveSelection(0, -1);
          break;

        case "ArrowRight":
          event.preventDefault();
          moveSelection(0, 1);
          break;
      }
    },
    [enterNumber, eraseSelected, moveSelection],
  );

  const remainingCells = useMemo(() => {
    if (!game) {
      return 0;
    }

    return values.filter((value) => value === 0).length;
  }, [game, values]);

  if (!game) {
    return (
      <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Choose a difficulty</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The timer starts as soon as the puzzle is generated.
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {(["easy", "medium", "hard"] as SudokuDifficulty[]).map(
            (difficulty) => {
              const config = DIFFICULTY_CONFIG[difficulty];

              return (
                <button
                  key={difficulty}
                  type="button"
                  disabled={generating}
                  onClick={() => startGame(difficulty)}
                  className="rounded-xl border bg-background p-5 text-left transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="font-semibold">{config.label}</div>

                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {config.description}
                  </p>
                </button>
              );
            },
          )}
        </div>

        {generating && (
          <div className="flex items-center justify-center gap-2 border-t px-5 py-4 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            Generating puzzle…
          </div>
        )}
      </section>
    );
  }

  return (
    <div
      ref={gameAreaRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="outline-none"
    >
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
              {difficultyLabel(game.difficulty)}
            </span>

            <span className="text-sm text-muted-foreground">
              {remainingCells} remaining
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-sm font-medium tabular-nums">
            <Clock3 className="size-4 text-muted-foreground" />
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
          <div className="mx-auto w-full max-w-[600px]">
            <SudokuBoard
              values={values}
              puzzle={game.puzzle}
              solution={game.solution}
              notes={notes}
              selectedIndex={selectedIndex}
              onSelect={(index) => {
                setSelectedIndex(index);

                gameAreaRef.current?.focus();
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }, (_, index) => index + 1).map(
                (number) => (
                  <Button
                    key={number}
                    type="button"
                    variant="outline"
                    className="h-12 text-lg font-semibold"
                    disabled={completed}
                    onClick={() => enterNumber(number)}
                  >
                    {number}
                  </Button>
                ),
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={notesMode ? "default" : "outline"}
                disabled={completed}
                onClick={() => setNotesMode((current) => !current)}
              >
                <Pencil className="size-4" />
                Notes
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={completed}
                onClick={eraseSelected}
              >
                <Eraser className="size-4" />
                Erase
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="font-medium text-foreground">
                  Keyboard:
                </strong>{" "}
                1–9 to enter, N for notes, Delete to erase and arrow keys to
                move.
              </p>
            </div>

            <div className="grid gap-2">
              <Button type="button" variant="outline" onClick={restartGame}>
                <RotateCcw className="size-4" />
                Restart puzzle
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setGame(null);
                  setValues([]);
                  setNotes(EMPTY_NOTES());
                  setSelectedIndex(null);
                  setCompleted(false);
                  setElapsedSeconds(0);
                }}
              >
                New game
              </Button>
            </div>
          </div>
        </div>
      </section>

      {completed && (
        <section className="mt-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Sparkles className="size-5" />
              </div>

              <div>
                <h2 className="font-semibold">Puzzle complete!</h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  You finished this{" "}
                  {difficultyLabel(game.difficulty).toLowerCase()} puzzle in{" "}
                  {formatTime(elapsedSeconds)}.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                setGame(null);
                setValues([]);
                setNotes(EMPTY_NOTES());
                setSelectedIndex(null);
                setCompleted(false);
                setElapsedSeconds(0);
              }}
            >
              Play another
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
