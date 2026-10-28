import type { GuessMode } from 'shared';
import { readHardMode } from './hard-mode';

export function currentMode(): GuessMode {
  return readHardMode() ? 'hard' : 'easy';
}

// a daily can be played once per mode, so "your scores" depend on which mode
// you're in; puzzles without per-mode data (generated sets) are left as they are
export function withMode<T extends { userGuesses: Record<string, number>; guessesByMode?: Record<GuessMode, Record<string, number>> }>(
  puzzle: T,
  mode: GuessMode,
): T {
  return puzzle.guessesByMode ? { ...puzzle, userGuesses: puzzle.guessesByMode[mode] } : puzzle;
}
