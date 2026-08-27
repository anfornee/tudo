import type {
  SudokuDifficulty,
  SudokuDifficultyConfig,
  SudokuPuzzle,
} from "./types";

const SIZE = 9;
const BOX_SIZE = 3;
const CELL_COUNT = SIZE * SIZE;

export const DIFFICULTY_CONFIG: Record<
  SudokuDifficulty,
  SudokuDifficultyConfig
> = {
  easy: {
    label: "Easy",
    description: "More starting numbers and quicker solves.",
    targetClues: 42,
  },
  medium: {
    label: "Medium",
    description: "A balanced puzzle with fewer obvious moves.",
    targetClues: 34,
  },
  hard: {
    label: "Hard",
    description: "Fewer clues and more careful deduction.",
    targetClues: 28,
  },
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function pattern(row: number, column: number): number {
  return (
    (BOX_SIZE * (row % BOX_SIZE) + Math.floor(row / BOX_SIZE) + column) % SIZE
  );
}

function createSolvedBoard(): number[] {
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const bands = shuffle([0, 1, 2]);
  const stacks = shuffle([0, 1, 2]);

  const rows = bands.flatMap((band) =>
    shuffle([0, 1, 2]).map((rowWithinBand) => band * BOX_SIZE + rowWithinBand),
  );

  const columns = stacks.flatMap((stack) =>
    shuffle([0, 1, 2]).map(
      (columnWithinStack) => stack * BOX_SIZE + columnWithinStack,
    ),
  );

  const board: number[] = [];

  for (const row of rows) {
    for (const column of columns) {
      board.push(numbers[pattern(row, column)]);
    }
  }

  return board;
}

function getCandidates(board: number[], index: number): number[] {
  if (board[index] !== 0) {
    return [];
  }

  const row = Math.floor(index / SIZE);
  const column = index % SIZE;

  const used = new Set<number>();

  for (let currentColumn = 0; currentColumn < SIZE; currentColumn += 1) {
    const value = board[row * SIZE + currentColumn];

    if (value !== 0) {
      used.add(value);
    }
  }

  for (let currentRow = 0; currentRow < SIZE; currentRow += 1) {
    const value = board[currentRow * SIZE + column];

    if (value !== 0) {
      used.add(value);
    }
  }

  const boxStartRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;

  const boxStartColumn = Math.floor(column / BOX_SIZE) * BOX_SIZE;

  for (
    let currentRow = boxStartRow;
    currentRow < boxStartRow + BOX_SIZE;
    currentRow += 1
  ) {
    for (
      let currentColumn = boxStartColumn;
      currentColumn < boxStartColumn + BOX_SIZE;
      currentColumn += 1
    ) {
      const value = board[currentRow * SIZE + currentColumn];

      if (value !== 0) {
        used.add(value);
      }
    }
  }

  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((number) => !used.has(number));
}

function findBestEmptyCell(board: number[]): {
  index: number;
  candidates: number[];
} | null {
  let bestIndex = -1;
  let bestCandidates: number[] | null = null;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (board[index] !== 0) {
      continue;
    }

    const candidates = getCandidates(board, index);

    if (candidates.length === 0) {
      return {
        index,
        candidates: [],
      };
    }

    if (bestCandidates === null || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;

      if (candidates.length === 1) {
        break;
      }
    }
  }

  if (bestIndex === -1 || bestCandidates === null) {
    return null;
  }

  return {
    index: bestIndex,
    candidates: bestCandidates,
  };
}

function countSolutions(board: number[], limit = 2): number {
  let solutions = 0;

  function solve(): void {
    if (solutions >= limit) {
      return;
    }

    const emptyCell = findBestEmptyCell(board);

    if (!emptyCell) {
      solutions += 1;
      return;
    }

    if (emptyCell.candidates.length === 0) {
      return;
    }

    for (const candidate of emptyCell.candidates) {
      board[emptyCell.index] = candidate;

      solve();

      board[emptyCell.index] = 0;

      if (solutions >= limit) {
        return;
      }
    }
  }

  solve();

  return solutions;
}

function createPuzzle(solution: number[], targetClues: number): number[] {
  const puzzle = [...solution];

  const positions = shuffle(
    Array.from({ length: CELL_COUNT }, (_, index) => index),
  );

  let clueCount = CELL_COUNT;

  for (const position of positions) {
    if (clueCount <= targetClues) {
      break;
    }

    const previousValue = puzzle[position];

    puzzle[position] = 0;

    const solutions = countSolutions([...puzzle], 2);

    if (solutions !== 1) {
      puzzle[position] = previousValue;
      continue;
    }

    clueCount -= 1;
  }

  return puzzle;
}

export function generateSudoku(difficulty: SudokuDifficulty): SudokuPuzzle {
  const targetClues = DIFFICULTY_CONFIG[difficulty].targetClues;

  let bestPuzzle: number[] | null = null;
  let bestSolution: number[] | null = null;
  let bestClueCount = CELL_COUNT + 1;

  /*
   * A removal pass occasionally can't quite reach the requested clue
   * count while preserving a unique solution. Try a few different solved
   * boards and keep whichever gets closest.
   */
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const solution = createSolvedBoard();

    const puzzle = createPuzzle(solution, targetClues);

    const clueCount = puzzle.filter((value) => value !== 0).length;

    if (clueCount < bestClueCount) {
      bestPuzzle = puzzle;
      bestSolution = solution;
      bestClueCount = clueCount;
    }

    if (clueCount <= targetClues) {
      break;
    }
  }

  if (!bestPuzzle || !bestSolution) {
    throw new Error("Unable to generate Sudoku puzzle.");
  }

  return {
    difficulty,
    puzzle: bestPuzzle,
    solution: bestSolution,
  };
}
