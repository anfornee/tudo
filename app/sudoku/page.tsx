import { SudokuGame } from "@/components/sudoku/SudokuGame";

export default function SudokuPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sudoku</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Pick a difficulty and take a quick brain break.
        </p>
      </div>

      <SudokuGame />
    </main>
  );
}
