export const HARD_MODE_SECONDS = 10;
const STORAGE_KEY = 'guessit-hard-mode';
const HARD_GUESSES_KEY = 'guessit-hard-guesses';

export function readHardMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyHardMode(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('hard-mode', enabled);
}

export function writeHardMode(enabled: boolean): void {
  applyHardMode(enabled);
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // storage can be unavailable; the toggle still works for this page
  }
}

export function readHardGuesses(): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HARD_GUESSES_KEY) ?? '[]');
    return new Set(
      Array.isArray(stored)
        ? stored.filter((questionId): questionId is string => typeof questionId === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

export function markHardGuess(questionId: string): void {
  const guesses = readHardGuesses();
  if (guesses.has(questionId)) return;
  guesses.add(questionId);
  try {
    localStorage.setItem(HARD_GUESSES_KEY, JSON.stringify([...guesses]));
  } catch {
    // storage can be unavailable; this only affects which mode shows the result
  }
}
