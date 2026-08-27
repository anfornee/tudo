export type SudokuDifficulty = "easy" | "medium" | "hard";

export interface SudokuPuzzle {
  difficulty: SudokuDifficulty;
  puzzle: number[];
  solution: number[];
}

export interface SudokuDifficultyConfig {
  label: string;
  description: string;
  targetClues: number;
}
