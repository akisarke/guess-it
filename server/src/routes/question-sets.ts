import type { FastifyInstance } from 'fastify';
import type { GeneratedGameSummaryResponse } from 'shared';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { loadGameSource } from '../services/game-source.js';
import { AuthenticationError } from '../errors/application-error.js';

export async function questionSetRoutes(app: FastifyInstance) {
  for (const endpoint of ['play', 'summary']) {
    app.get<{ Params: { id: string } }>(`/:id/${endpoint}`, {
      preHandler: [authenticate, requireRegistered],
      schema: { params: {
        type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } },
      } },
    }, async (request) => {
      const userId = request.userId;
      if (!userId) throw new AuthenticationError('Not authenticated');
      const game = await loadGameSource(app.prisma, { kind: 'generated', id: request.params.id }, userId);
      if (endpoint === 'play') return game;
      const completed = game.set.completed;
      return {
        ...game, completed,
        averageScore: completed
          ? game.questions.reduce((sum, question) => sum + game.userGuesses[question.id], 0) / game.questions.length
          : null,
      } satisfies GeneratedGameSummaryResponse;
    });
  }
}
