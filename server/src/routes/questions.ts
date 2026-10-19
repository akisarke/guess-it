import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import {
  AiConfigurationError,
  AiProviderError,
  AiResponseError,
  generateQuestionSet,
  type GenerationInput,
  type GeneratedQuestionBatch,
} from '../services/ai.js';
import { createGeneratedSet, GeneratedSetQuotaError } from '../services/generated-sets.js';
import { getTodayPuzzle } from '../services/daily-puzzle.js';
import { buildLimiterKey, semanticLimit } from '../services/rate-limit.js';
import { AuthenticationError, AuthorizationError, ExternalServiceError, RateLimitError, ValidationError, NotFoundError } from '../errors/application-error.js';

type GenerateBody = Readonly<{ readonly topic: string; readonly difficulty?: 'easy' | 'medium' | 'hard' | null }>;

export type QuestionRouteDependencies = Readonly<{
  readonly authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  readonly generateQuestionSet: (input: GenerationInput) => Promise<GeneratedQuestionBatch>;
  readonly createGeneratedSet: typeof createGeneratedSet;
}>;

type RouteOptions = Readonly<{ readonly dependencies?: QuestionRouteDependencies }>;

export function buildGeneratedSetTitle(topic: string): string {
  const normalized = topic.trim();
  if (normalized.length <= 60) return normalized;
  const prefix = normalized.slice(0, 57).trimEnd();
  const boundary = prefix.lastIndexOf(' ');
  return `${boundary > 0 ? prefix.slice(0, boundary) : prefix}...`;
}

function nextUtcReset(now: Date): string {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toISOString();
}

function defaultDependencies(prisma: PrismaClient, config: Parameters<typeof generateQuestionSet>[1]): QuestionRouteDependencies {
  return {
    authenticate,
    generateQuestionSet: (input) => generateQuestionSet(input, config),
    createGeneratedSet: (client, input) => createGeneratedSet(client, input),
  };
}

export const questionRoutes: FastifyPluginAsync<RouteOptions> = async (app, options) => {
  const dependencies = options.dependencies ?? defaultDependencies(app.prisma, app.config);

  app.post<{ Body: GenerateBody }>('/generate', {
    preHandler: [dependencies.authenticate, semanticLimit('generationIp', (request) => buildLimiterKey('generation-ip', request.ip)), semanticLimit('generationUser', (request) => request.userId ? buildLimiterKey('generation-user', request.userId) : undefined)],
    schema: {
      body: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic: { type: 'string', minLength: 1, maxLength: 200 },
          difficulty: { type: ['string', 'null'], enum: ['easy', 'medium', 'hard', null] },
        },
      },
    },
  }, async (request) => {
    if (request.authProvider === 'anonymous') throw new AuthorizationError('Create an account to generate questions.');
    const userId = request.userId ?? request.session?.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');

    const topic = request.body.topic.trim();
    if (!topic) throw new ValidationError('Topic is required');

    try {
      let dailyQuestions: readonly { readonly prompt: string }[] = [];
      try {
        const today = await getTodayPuzzle(app.prisma);
        dailyQuestions = today ? await app.prisma.question.findMany({ where: { id: { in: today.questionIds } }, select: { prompt: true } }) : [];
      } catch (error) {
        app.log.warn({ error }, 'Could not load daily questions for AI exclusion');
      }
      const questions = await dependencies.generateQuestionSet({ topic, difficulty: request.body.difficulty ?? null, excludedPrompts: dailyQuestions.map(({ prompt }) => prompt) });
      const result = await dependencies.createGeneratedSet(app.prisma, {
        ownerId: userId,
        title: buildGeneratedSetTitle(topic),
        topic,
        difficulty: request.body.difficulty ?? null,
        questions,
        sourceUrl: app.config.appUrl,
      });
      return { set: result.set, questions: result.set.questions, remainingGenerations: result.remainingGenerations };
    } catch (error) {
      if (error instanceof GeneratedSetQuotaError) {
        throw new RateLimitError('Daily generation limit reached', {
          code: 'GENERATION_QUOTA_EXCEEDED',
          resetAt: nextUtcReset(new Date()),
        });
      }
      if (error instanceof AiConfigurationError || error instanceof AiProviderError || error instanceof AiResponseError) {
        app.log.error({ error }, 'Question generation provider failure');
        throw new ExternalServiceError('Question generation is temporarily unavailable', { cause: error });
      }
      throw error;
    }
  });

  app.get<{ Params: { readonly id: string } }>('/:id', { preHandler: [dependencies.authenticate, requireRegistered] }, async (request) => {
    const question = await app.prisma.question.findUnique({
      where: { id: request.params.id },
      select: { id: true, prompt: true, unit: true, source: true, topic: true },
    });
    if (!question) throw new NotFoundError('Question not found');
    return { question };
  });
};
