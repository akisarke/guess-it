import type { PrismaClient } from '@prisma/client';
import type { DailyGameSourceResponse, GeneratedGameSourceResponse, GameSourceRef, GameSourceResponse, GuessMode, QuestionPublic } from 'shared';
import { NotFoundError, AuthorizationError } from '../errors/application-error.js';

export class GameSourceNotFound extends NotFoundError {
  constructor() {
    super('Game source not found', { code: 'NOT_FOUND' });
  }
}

export class GameSourceForbidden extends AuthorizationError {
  constructor() {
    super('Game source access forbidden', { code: 'FORBIDDEN' });
  }
}

const publicQuestionSelect = { id: true, prompt: true, unit: true } as const;

function publicTriple(questions: readonly QuestionPublic[]): readonly [QuestionPublic, QuestionPublic, QuestionPublic] {
  const [first, second, third] = questions.map(({ id, prompt, unit }) => ({ id, prompt, unit }));
  if (questions.length !== 3 || !first || !second || !third) throw new GameSourceNotFound();
  return [first, second, third];
}

async function viewerGuesses(prisma: PrismaClient, userId: string, questions: readonly QuestionPublic[]) {
  const guesses = await prisma.guess.findMany({
    where: { userId, questionId: { in: questions.map((question) => question.id) } },
    select: { questionId: true, score: true },
  });
  return Object.fromEntries(guesses.map((guess) => [guess.questionId, Number(guess.score)]));
}

// a daily can be played once per mode: the first attempt (Guess) in whichever
// mode it was made, and one practice replay (PracticeGuess) in the other
async function dailyProgress(prisma: PrismaClient, userId: string, questions: readonly QuestionPublic[], mode: GuessMode) {
  const guessesByMode = await dailyGuessesByMode(prisma, userId, questions);
  return { userGuesses: guessesByMode[mode], guessesByMode };
}

async function dailyGuessesByMode(prisma: PrismaClient, userId: string, questions: readonly QuestionPublic[]) {
  const questionIds = questions.map((question) => question.id);
  const [counted, practice] = await Promise.all([
    prisma.guess.findMany({ where: { userId, questionId: { in: questionIds } }, select: { questionId: true, score: true, mode: true } }),
    prisma.practiceGuess.findMany({ where: { userId, questionId: { in: questionIds } }, select: { questionId: true, score: true, mode: true } }),
  ]);
  const byMode: Record<GuessMode, Record<string, number>> = { easy: {}, hard: {} };
  for (const guess of [...counted, ...practice]) byMode[guess.mode][guess.questionId] = Number(guess.score);
  return byMode;
}

export function loadGameSource(prisma: PrismaClient, ref: DailyGameSourceResponse['source'], userId: string, mode?: GuessMode): Promise<DailyGameSourceResponse>;
export function loadGameSource(prisma: PrismaClient, ref: GeneratedGameSourceResponse['source'], userId: string, mode?: GuessMode): Promise<GeneratedGameSourceResponse>;
export function loadGameSource(prisma: PrismaClient, ref: GameSourceRef, userId: string, mode?: GuessMode): Promise<GameSourceResponse>;
export async function loadGameSource(prisma: PrismaClient, ref: GameSourceRef, userId: string, mode: GuessMode = 'easy'): Promise<GameSourceResponse> {
  switch (ref.kind) {
    case 'daily': {
      const puzzle = await prisma.dailyPuzzle.findUnique({ where: { id: ref.id } });
      if (!puzzle) throw new GameSourceNotFound();
      const rows = await prisma.question.findMany({
        where: { id: { in: puzzle.questionIds } }, select: publicQuestionSelect,
      });
      const byId = new Map(rows.map((question) => [question.id, question]));
      const questions = publicTriple(puzzle.questionIds.flatMap((id) => {
        const question = byId.get(id);
        return question ? [question] : [];
      }));
      return {
        source: { kind: 'daily', id: puzzle.id },
        puzzle: { ...puzzle, puzzleDate: puzzle.puzzleDate.toISOString() },
        questions, ...await dailyProgress(prisma, userId, questions, mode),
      };
    }
    case 'generated': {
      const set = await prisma.questionSet.findUnique({
        where: { id: ref.id },
        select: {
          id: true, ownerId: true, title: true, topic: true, difficulty: true, createdAt: true,
          questions: { orderBy: { position: 'asc' }, select: { question: { select: publicQuestionSelect } } },
        },
      });
      if (!set) throw new GameSourceNotFound();
      if (set.ownerId !== userId) throw new GameSourceForbidden();
      const questions = publicTriple(set.questions.map(({ question }) => question));
      const userGuesses = await viewerGuesses(prisma, userId, questions);
      const difficulty = set.difficulty === 'easy' || set.difficulty === 'medium' || set.difficulty === 'hard' ? set.difficulty : null;
      return {
        source: { kind: 'generated', id: set.id }, questions, userGuesses,
        set: {
          id: set.id, title: set.title, topic: set.topic, difficulty,
          createdAt: set.createdAt.toISOString(),
          completed: questions.every((question) => Object.hasOwn(userGuesses, question.id)),
        },
      };
    }
    default: return ref satisfies never;
  }
}
