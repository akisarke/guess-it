import type { QuestionPublic } from 'shared';

export interface PuzzleProgress {
  answeredCount: number;
  firstUnansweredIndex: number;
  isComplete: boolean;
}

export function derivePuzzleProgress(puzzle: { questions: readonly QuestionPublic[]; userGuesses: Record<string, number> }): PuzzleProgress {
  const firstUnansweredIndex = puzzle.questions.findIndex((question) => !puzzle.userGuesses[question.id]);
  const answeredCount = puzzle.questions.reduce(
    (count, question) => count + (puzzle.userGuesses[question.id] ? 1 : 0),
    0,
  );

  return {
    answeredCount,
    firstUnansweredIndex,
    isComplete: firstUnansweredIndex === -1,
  };
}
