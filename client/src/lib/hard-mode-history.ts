import type { QuestionPublic } from 'shared';

export interface HardModeResult {
  question: QuestionPublic;
  guess: number;
  answer: number;
  score: number;
}

export interface HardModeRun {
  puzzleNumber: number;
  puzzleDate: string;
  completedAt: string;
  results: HardModeResult[];
}

const RUNS_KEY = 'guessit-hard-mode-runs';
const SEEN_KEY = 'guessit-hard-mode-seen';
const SEEN_QUESTIONS_KEY = 'guessit-hard-mode-seen-questions';
const MAX_RUNS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isResult(value: unknown): value is HardModeResult {
  if (!isRecord(value) || !isRecord(value.question)) return false;
  return (
    typeof value.question.id === 'string' &&
    typeof value.question.prompt === 'string' &&
    typeof value.question.unit === 'string' &&
    isFiniteNumber(value.guess) &&
    isFiniteNumber(value.answer) &&
    isFiniteNumber(value.score)
  );
}

function isRun(value: unknown): value is HardModeRun {
  return (
    isRecord(value) &&
    isFiniteNumber(value.puzzleNumber) &&
    typeof value.puzzleDate === 'string' &&
    typeof value.completedAt === 'string' &&
    Array.isArray(value.results) &&
    value.results.length > 0 &&
    value.results.every(isResult)
  );
}

export function readHardModeRuns(): HardModeRun[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(isRun).slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

export function readLatestHardModeRun(): HardModeRun | null {
  return readHardModeRuns()[0] ?? null;
}

export function readSeenHardModePuzzles(): Set<number> {
  const seen = new Set<number>();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    if (Array.isArray(stored)) {
      for (const puzzleNumber of stored) {
        if (isFiniteNumber(puzzleNumber)) seen.add(puzzleNumber);
      }
    }
  } catch {
    // malformed local history should not block hard mode
  }
  for (const run of readHardModeRuns()) seen.add(run.puzzleNumber);
  return seen;
}

export function readSeenHardModeQuestions(): Set<string> {
  const seen = new Set<string>();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SEEN_QUESTIONS_KEY) ?? '[]');
    if (Array.isArray(stored)) {
      for (const questionId of stored) {
        if (typeof questionId === 'string') seen.add(questionId);
      }
    }
  } catch {
    // malformed local history should not block hard mode
  }
  for (const run of readHardModeRuns()) {
    for (const result of run.results) seen.add(result.question.id);
  }
  return seen;
}

export function markHardModePuzzleSeen(puzzleNumber: number, questionIds: readonly string[]): void {
  const seenPuzzles = readSeenHardModePuzzles();
  if (!seenPuzzles.has(puzzleNumber)) {
    seenPuzzles.add(puzzleNumber);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seenPuzzles]));
    } catch {
      // storage can be unavailable; the puzzle still loads
    }
  }

  const seenQuestions = readSeenHardModeQuestions();
  let changed = false;
  for (const questionId of questionIds) {
    if (!seenQuestions.has(questionId)) {
      seenQuestions.add(questionId);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify([...seenQuestions]));
  } catch {
    // storage can be unavailable; the puzzle still loads
  }
}

export function saveHardModeRun(run: HardModeRun): void {
  if (!isRun(run)) return;
  const runs = readHardModeRuns().filter((entry) => entry.puzzleNumber !== run.puzzleNumber);
  runs.unshift(run);
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // storage can be unavailable; the current result still renders
  }
  markHardModePuzzleSeen(run.puzzleNumber, run.results.map((result) => result.question.id));
}
