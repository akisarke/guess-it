import type { PuzzleResponse } from 'shared';
import { describe, expect, it } from 'vitest';
import { derivePuzzleProgress } from './puzzle-progress';

function puzzleWithScores(scores: readonly number[]): PuzzleResponse {
  const questions = scores.map((score, index) => ({
    id: `question-${index + 1}`,
    prompt: `Question ${index + 1}`,
    unit: 'items',
  }));

  return {
    source: { kind: 'daily', id: 'puzzle-1' },
    puzzle: {
      id: 'puzzle-1',
      puzzleNumber: 1,
      puzzleDate: '2026-09-12',
      questionIds: questions.map((question) => question.id),
      questions,
    },
    questions,
    userGuesses: Object.fromEntries(questions.map((question, index) => [question.id, scores[index] ?? 0])),
  };
}

describe('derivePuzzleProgress', () => {
  it('derives a fresh puzzle state', () => {

    const puzzle = puzzleWithScores([0, 0, 0]);

    const progress = derivePuzzleProgress(puzzle);

    expect(progress).toEqual({ answeredCount: 0, firstUnansweredIndex: 0, isComplete: false });
  });

  it('derives a partial puzzle state', () => {

    const puzzle = puzzleWithScores([2, 0, 0]);

    const progress = derivePuzzleProgress(puzzle);

    expect(progress).toEqual({ answeredCount: 1, firstUnansweredIndex: 1, isComplete: false });
  });

  it('derives a complete puzzle state', () => {

    const puzzle = puzzleWithScores([1, 2, 3]);

    const progress = derivePuzzleProgress(puzzle);

    expect(progress).toEqual({ answeredCount: 3, firstUnansweredIndex: -1, isComplete: true });
  });
});
