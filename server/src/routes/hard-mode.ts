import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { utcDayRange } from '../services/daily-puzzle.js';
import { computeScore } from '../services/scoring.js';
import { computeDistribution } from '../services/distribution.js';
import { ApplicationError, AuthenticationError, AuthorizationError, NotFoundError } from '../errors/application-error.js';

const publicQuestionSelect = { id: true, prompt: true, unit: true } as const;

class InvalidAnswerError extends ApplicationError {
  constructor() {
    super(422, 'VALIDATION_ERROR', 'This question has an invalid answer');
  }
}

export async function hardModeRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get<{ Querystring: { exclude?: string; excludeQuestions?: string } }>(
    '/puzzle',
    { preHandler: [authenticate] },
    async (request) => {
      const userId = request.userId;
      if (!userId) throw new AuthenticationError('Not authenticated');
      const excludedPuzzles = new Set(
        (typeof request.query.exclude === 'string' ? request.query.exclude : '')
          .split(',')
          .slice(0, 1000)
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      );
      const excludedQuestions = new Set(
        (typeof request.query.excludeQuestions === 'string' ? request.query.excludeQuestions : '')
          .split(',')
          .slice(0, 1000)
          .filter((value) => value.length > 0 && value.length <= 100),
      );
      const todayStart = utcDayRange(new Date()).gte;

      const [pastPuzzles, protectedPuzzles] = await Promise.all([
        prisma.dailyPuzzle.findMany({
          where: { puzzleDate: { lt: todayStart } },
          select: { id: true, puzzleNumber: true, puzzleDate: true, questionIds: true },
        }),
        prisma.dailyPuzzle.findMany({
          where: { puzzleDate: { gte: todayStart } },
          select: { questionIds: true },
        }),
      ]);

      const protectedIds = new Set(protectedPuzzles.flatMap((puzzle) => puzzle.questionIds));
      // anything that would spoil today's or a scheduled puzzle is never offered
      const playable = pastPuzzles.filter(
        (puzzle) =>
          puzzle.questionIds.length === 3 &&
          puzzle.questionIds.every((questionId) => !protectedIds.has(questionId)),
      );
      if (playable.length === 0) throw new NotFoundError('There are no past puzzles to replay yet. Come back after a few daily puzzles have gone by.');

      const pastQuestionIds = [...new Set(playable.flatMap((puzzle) => puzzle.questionIds))];
      const [guesses, questions] = await Promise.all([
        prisma.guess.findMany({
          where: { userId, questionId: { in: pastQuestionIds } },
          select: { questionId: true },
        }),
        prisma.question.findMany({
          where: { id: { in: pastQuestionIds } },
          select: publicQuestionSelect,
        }),
      ]);

      const guessedIds = new Set(guesses.map((guess) => guess.questionId));
      const questionById = new Map(questions.map((question) => [question.id, question]));
      const complete = playable.filter(
        (puzzle) => puzzle.questionIds.every((questionId) => questionById.has(questionId)),
      );
      // a player never sees a question twice: not one they guessed as a daily,
      // and not one they already met in hard mode
      const fresh = complete.filter(
        (puzzle) =>
          !excludedPuzzles.has(puzzle.puzzleNumber) &&
          puzzle.questionIds.every((questionId) => !excludedQuestions.has(questionId) && !guessedIds.has(questionId)),
      );
      if (fresh.length === 0) throw new NotFoundError("You've played every past puzzle. A new one unlocks every day.");

      const chosen = fresh[Math.floor(Math.random() * fresh.length)]!;
      return {
        puzzleNumber: chosen.puzzleNumber,
        puzzleDate: chosen.puzzleDate.toISOString(),
        questions: chosen.questionIds.map((questionId) => {
          const { id, prompt, unit } = questionById.get(questionId)!;
          return { id, prompt, unit };
        }),
      };
    },
  );

  app.post<{ Body: { questionId: string; value: number } }>('/guess', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['questionId', 'value'],
        additionalProperties: false,
        properties: {
          questionId: { type: 'string', minLength: 1 },
          value: { type: 'number', minimum: 1, maximum: 1e15, multipleOf: 1 },
        },
      },
    },
  }, async (request) => {
    if (!request.userId) throw new AuthenticationError('Not authenticated');
    const { questionId, value } = request.body;
    const todayStart = utcDayRange(new Date()).gte;

    const [pastPuzzle, protectedPuzzle] = await Promise.all([
      prisma.dailyPuzzle.findFirst({
        where: { puzzleDate: { lt: todayStart }, questionIds: { has: questionId } },
        select: { id: true },
      }),
      prisma.dailyPuzzle.findFirst({
        where: { puzzleDate: { gte: todayStart }, questionIds: { has: questionId } },
        select: { id: true },
      }),
    ]);
    if (!pastPuzzle || protectedPuzzle) {
      throw new AuthorizationError('That question is not available for hard mode.');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { answer: true },
    });
    if (!question) throw new NotFoundError('Question not found');
    const answer = Number(question.answer);
    const { score, direction, scoreBand } = computeScore(value, answer);
    if (!Number.isFinite(score)) throw new InvalidAnswerError();

    // practice guesses aren't stored, so the crowd shown is the original daily
    // players with this guess marked on top
    const distribution = { ...(await computeDistribution(prisma, questionId)), userGuess: value };
    return { score, answer, direction, scoreBand, distribution };
  });
}
