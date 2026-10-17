import type { QuestionPublic } from 'shared';

export interface PuzzleProgress {
  readonly answeredCount: number;
  readonly firstUnansweredIndex: number;
  readonly isComplete: boolean;
}

export function derivePuzzleProgress(puzzle: { readonly questions: readonly QuestionPublic[]; readonly userGuesses: Readonly<Record<string, number>> }): PuzzleProgress {
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
