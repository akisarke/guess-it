import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import type { GuessRequest } from 'shared';
import { GameSourceForbidden, loadGameSource } from '../services/game-source.js';
import { authenticate } from '../middleware/auth.js';
import { computeScore } from '../services/scoring.js';
import { updateStreak } from '../services/streaks.js';
import { checkAndAwardBadges } from '../services/badges.js';
import { computeDistribution } from '../services/distribution.js';
import { getTodayPuzzle } from '../services/daily-puzzle.js';
import { ApplicationError, AuthenticationError, ConflictError, NotFoundError, AuthorizationError } from '../errors/application-error.js';

class InvalidAnswerError extends ApplicationError {
  constructor() {
    super(422, 'VALIDATION_ERROR', 'This question has an invalid answer');
  }
}

export async function guessRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.post<{ Body: GuessRequest }>('/guess', {
    preHandler: [authenticate],
    schema: { body: {
      type: 'object', required: ['source', 'questionId', 'value'], additionalProperties: false,
      properties: {
        source: {
          type: 'object', required: ['kind', 'id'], additionalProperties: false,
          properties: {
            kind: { type: 'string', enum: ['daily', 'generated'] },
            id: { type: 'string', minLength: 1 },
          },
        },
        questionId: { type: 'string', minLength: 1 },
         value: { type: 'number', minimum: 1, maximum: 1e15, multipleOf: 1 },
      },
    } },
  }, async (request) => {
    const { source, questionId, value } = request.body;
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    if (request.authProvider === 'anonymous' && source.kind !== 'daily') throw new AuthorizationError('Create an account to play generated questions.');
    const game = await loadGameSource(prisma, source, userId);
    if (!game.questions.some((question) => question.id === questionId)) throw new GameSourceForbidden();
    const question = await prisma.question.findUnique({
      where: { id: questionId }, select: { answer: true, napkinMath: true },
    });
    if (!question) throw new NotFoundError('Question not found');
    const answer = Number(question.answer);
    const { score, direction, scoreBand } = computeScore(value, answer);
    if (!Number.isFinite(score)) {
      throw new InvalidAnswerError();
    }
    try {
      await prisma.guess.create({ data: { userId, questionId, value, score } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Already guessed this question');
      }
      throw error;
    }
    await updateStreak(prisma, userId, new Date());
    await checkAndAwardBadges(prisma, userId, questionId, score);
    return { score, answer, direction, scoreBand, napkinMath: question.napkinMath };
  });

  app.get<{ Params: { id: string } }>('/puzzle/:id/distribution', {
    preHandler: [authenticate],
  }, async (request) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    if (request.authProvider === 'anonymous') {
      const today = await getTodayPuzzle(prisma);
      if (!today?.questionIds.includes(request.params.id)) throw new AuthorizationError('Anonymous players can only view today’s daily guess.');
    }
    const guess = await prisma.guess.findUnique({
      where: { userId_questionId: { userId, questionId: request.params.id } },
    });
    if (!guess) throw new AuthorizationError('Submit your guess before viewing the answer');
    return computeDistribution(prisma, request.params.id, userId);
  });
}
