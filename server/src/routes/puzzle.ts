import type { GuessMode } from 'shared';
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { getTodayPuzzle, utcDayRange } from '../services/daily-puzzle.js';
import { loadGameSource } from '../services/game-source.js';
import { AuthenticationError, NotFoundError } from '../errors/application-error.js';

export async function puzzleRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get<{ Querystring: { limit?: string } }>('/archive', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const rawLimit = request.query.limit;
    const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 12;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 24) : 12;
    const pastPuzzles = await prisma.dailyPuzzle.findMany({
      where: { puzzleDate: { lt: utcDayRange(new Date()).gte } },
      orderBy: { puzzleNumber: 'asc' },
      take: limit + 1,
      select: { puzzleNumber: true, puzzleDate: true, questionIds: true },
    });

    const page = pastPuzzles.slice(0, limit);
    const questionIds = [...new Set(page.flatMap((puzzle) => puzzle.questionIds))];
    const questions = questionIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: questionIds } },
          select: { id: true, prompt: true, unit: true, topic: true },
        })
      : [];
    const questionById = new Map(questions.map((question) => [question.id, question]));

    return {
      puzzles: page.map((puzzle) => ({
        puzzleNumber: puzzle.puzzleNumber,
        puzzleDate: puzzle.puzzleDate.toISOString(),
        questions: puzzle.questionIds.flatMap((id) => {
          const question = questionById.get(id);
          return question ? [{ id: question.id, prompt: question.prompt, unit: question.unit }] : [];
        }),
      })),
      hasMore: pastPuzzles.length > limit,
    };
  });

  app.get<{ Querystring: { mode?: string } }>('/today', { preHandler: [authenticate] }, async (request) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const puzzle = await getTodayPuzzle(prisma);

    if (!puzzle) {
      throw new NotFoundError('No puzzle for today');
    }

    return loadGameSource(prisma, { kind: 'daily', id: puzzle.id }, userId, modeFromQuery(request.query));
  });

  app.get<{ Params: { puzzleNumber: string }; Querystring: { mode?: string } }>('/:puzzleNumber', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const { puzzleNumber } = request.params;
    const num = parseInt(puzzleNumber);

    const puzzle = await prisma.dailyPuzzle.findUnique({
      where: { puzzleNumber: num },
    });

    if (!puzzle) {
      throw new NotFoundError('Puzzle not found');
    }

    return loadGameSource(prisma, { kind: 'daily', id: puzzle.id }, userId, modeFromQuery(request.query));
  });
}

export function modeFromQuery(query: { mode?: string }): GuessMode {
  return query.mode === 'hard' ? 'hard' : 'easy';
}
