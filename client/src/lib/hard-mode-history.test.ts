import { beforeEach, describe, expect, it } from 'vitest';
import {
  markHardModePuzzleSeen,
  readHardModeRuns,
  readLatestHardModeRun,
  readSeenHardModePuzzles,
  readSeenHardModeQuestions,
  saveHardModeRun,
} from './hard-mode-history';

const run = {
  puzzleNumber: 43,
  puzzleDate: '2026-10-01T00:00:00.000Z',
  completedAt: '2026-10-27T12:00:00.000Z',
  results: [
    {
      question: { id: 'q1', prompt: 'Question one?', unit: 'm' },
      guess: 10,
      answer: 20,
      score: 2,
    },
  ],
};

describe('hard mode history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves the latest completed run and marks its puzzle and questions as seen', () => {
    saveHardModeRun(run);

    expect(readLatestHardModeRun()).toEqual(run);
    expect(readSeenHardModePuzzles()).toEqual(new Set([43]));
    expect(readSeenHardModeQuestions()).toEqual(new Set(['q1']));
  });

  it('tracks questions from abandoned puzzles so they cannot repeat', () => {
    markHardModePuzzleSeen(43, ['q1', 'q2']);
    markHardModePuzzleSeen(44, ['q2', 'q3']);

    expect(readSeenHardModePuzzles()).toEqual(new Set([43, 44]));
    expect(readSeenHardModeQuestions()).toEqual(new Set(['q1', 'q2', 'q3']));
  });

  it('keeps only the latest run for a repeated puzzle', () => {
    saveHardModeRun(run);
    saveHardModeRun({ ...run, completedAt: '2026-10-28T12:00:00.000Z' });

    expect(readHardModeRuns()).toHaveLength(1);
    expect(readLatestHardModeRun()?.completedAt).toBe('2026-10-28T12:00:00.000Z');
  });

  it('ignores malformed history', () => {
    localStorage.setItem('guessit-hard-mode-runs', '{not json');
    localStorage.setItem('guessit-hard-mode-seen', '{"not":"an array"}');
    localStorage.setItem('guessit-hard-mode-seen-questions', '{"not":"an array"}');

    expect(readHardModeRuns()).toEqual([]);
    expect(readSeenHardModePuzzles()).toEqual(new Set());
    expect(readSeenHardModeQuestions()).toEqual(new Set());
  });
});
