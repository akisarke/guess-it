import { beforeEach, describe, expect, it } from 'vitest';
import { markHardGuess, readHardGuesses } from './hard-mode';

describe('hard mode guess tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers each daily question guessed in hard mode', () => {
    markHardGuess('q1');
    markHardGuess('q2');
    markHardGuess('q1');

    expect(readHardGuesses()).toEqual(new Set(['q1', 'q2']));
  });

  it('ignores malformed storage', () => {
    localStorage.setItem('guessit-hard-guesses', 'not json');

    expect(readHardGuesses()).toEqual(new Set());
  });
});
