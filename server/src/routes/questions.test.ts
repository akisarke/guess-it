import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { describe, expect, test } from 'vitest';
import { parseGeneratedQuestionSetId, parseQuestionId, type GeneratedQuestionSet } from 'shared';
import { questionRoutes, type QuestionRouteDependencies } from './questions.js';
import { GeneratedSetQuotaError, type CreateGeneratedSetInput } from '../services/generated-sets.js';
import { AiProviderError } from '../services/ai.js';
import type { GeneratedQuestion, GeneratedQuestionBatch } from '../services/ai.js';
import { createDeterministicLimiterStore } from '../services/rate-limit.js';
import { loadConfig } from '../config.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { AuthenticationError } from '../errors/application-error.js';

const generatedQuestions: GeneratedQuestionBatch = [
  { prompt: 'Question one', unit: 'ITEMS', answer: 10, napkinMath: 'ten' },
  { prompt: 'Question two', unit: 'ITEMS', answer: 20, napkinMath: 'twenty' },
  { prompt: 'Question three', unit: 'ITEMS', answer: 30, napkinMath: 'thirty' },
];

const set: GeneratedQuestionSet = {
  id: parseGeneratedQuestionSetId('set-1'),
  title: 'Topic set',
  topic: 'topic',
  difficulty: 'medium',
  createdAt: '2026-09-12T12:00:00.000Z',
  completed: false,
  questions: [
    { prompt: generatedQuestions[0].prompt, unit: generatedQuestions[0].unit, id: parseQuestionId('question-1') },
    { prompt: generatedQuestions[1].prompt, unit: generatedQuestions[1].unit, id: parseQuestionId('question-2') },
    { prompt: generatedQuestions[2].prompt, unit: generatedQuestions[2].unit, id: parseQuestionId('question-3') },
  ],
};

const createDependencies = (remaining = 3): QuestionRouteDependencies => ({
  authenticate: async (request, reply) => {
    if (request.headers.authorization !== 'Bearer test-user') {
       throw new AuthenticationError('Not authenticated');
    }
    request.userId = 'user-1';
    request.session = { userId: 'user-1', sessionVersion: 0, issuedAt: 1, expiresAt: Number.MAX_SAFE_INTEGER };
  },
  generateQuestionSet: async () => generatedQuestions,
  createGeneratedSet: async () => ({ set, remainingGenerations: remaining - 1 }),
  deleteGeneratedSet: async () => {},
});

async function buildApp(dependencies: QuestionRouteDependencies) {
  const app = Fastify();
  registerHttpErrorHandler(app);
  app.decorate('prisma', new PrismaClient());
  app.decorate('config', loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/guessit', SESSION_SECRET: 'q'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 'q'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' }));
  app.decorate('limiterStore', createDeterministicLimiterStore());
  await app.register(questionRoutes, { dependencies });
  return app;
}

describe('POST /generate', () => {
  test('keeps the full topic while bounding a long deterministic title', async () => {
    const topic = 'A very long human topic about estimating the number of ordinary objects in a city across many different neighborhoods and seasons';
    let captured: CreateGeneratedSetInput | undefined;
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(),
      createGeneratedSet: async (_client, input) => {
        captured = input;
        return { set, remainingGenerations: 2 };
      },
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: 'POST', url: '/generate', headers: { authorization: 'Bearer test-user' }, payload: { topic } });

    expect(response.statusCode).toBe(200);
    expect(captured?.topic).toBe(topic);
    expect(captured?.title).toBe('A very long human topic about estimating the number of...');
    expect(captured?.title.length).toBeLessThanOrEqual(60);
  });

  test('keeps a short topic unchanged as the title', async () => {
    let captured: CreateGeneratedSetInput | undefined;
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(),
      createGeneratedSet: async (_client, input) => {
        captured = input;
        return { set, remainingGenerations: 2 };
      },
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: 'POST', url: '/generate', headers: { authorization: 'Bearer test-user' }, payload: { topic: 'city parks' } });

    expect(response.statusCode).toBe(200);
    expect(captured?.topic).toBe('city parks');
    expect(captured?.title).toBe('city parks');
  });

  test('accepts a null difficulty and delivers it to the generator', async () => {
    let captured: 'easy' | 'medium' | 'hard' | null | undefined;
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(),
      generateQuestionSet: async (input) => {
        captured = input.difficulty;
        return generatedQuestions;
      },
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({
      method: 'POST',
      url: '/generate',
      headers: { authorization: 'Bearer test-user' },
      payload: { topic: 'topic', difficulty: null },
    });

    expect(response.statusCode).toBe(200);
    expect(captured).toBeNull();
  });

  test('returns 401 before generation for unauthenticated requests', async () => {
    const app = await buildApp(createDependencies());

    const response = await app.inject({ method: 'POST', url: '/generate', payload: { topic: 'topic' } });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTHENTICATION_REQUIRED');
  });

  test('returns the initial remaining count without consuming a generation', async () => {
    let generated = false;
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(),
      generateQuestionSet: async () => {
        generated = true;
        return generatedQuestions;
      },
      createGeneratedSet: async () => ({ set, remainingGenerations: 2 }),
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: 'POST', url: '/generate', headers: { authorization: 'Bearer test-user' }, payload: { topic: 'topic' } });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).remainingGenerations).toBe(2);
    expect(generated).toBe(true);
  });

  test('returns the atomic set response and decremented quota', async () => {
    let createCalls = 0;
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(3),
      createGeneratedSet: async () => {
        createCalls += 1;
        return { set, remainingGenerations: 2 };
      },
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: 'POST', url: '/generate', headers: { authorization: 'Bearer test-user' }, payload: { topic: 'topic', difficulty: 'medium' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(createCalls).toBe(1);
    expect(body.set.questions).toHaveLength(3);
    expect(body.questions).toEqual(body.set.questions);
    expect(body.questions[0]).not.toHaveProperty('answer');
    expect(body.remainingGenerations).toBe(2);
  });

  test('maps quota exhaustion to 429 with a UTC reset timestamp', async () => {
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(),
      createGeneratedSet: async () => {
        throw new GeneratedSetQuotaError();
      },
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: 'POST', url: '/generate', headers: { authorization: 'Bearer test-user' }, payload: { topic: 'topic' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(429);
    expect(body.code).toBe('GENERATION_QUOTA_EXCEEDED');
    expect(body.resetAt).toMatch(/T00:00:00\.000Z$/);
  });

  test('maps provider and configuration failures to stable 503 copy', async () => {
    const dependencies: QuestionRouteDependencies = {
      ...createDependencies(),
      generateQuestionSet: async () => {
        throw new AiProviderError('provider secret detail');
      },
    };
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: 'POST', url: '/generate', headers: { authorization: 'Bearer test-user' }, payload: { topic: 'topic' } });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).code).toBe('SERVICE_UNAVAILABLE');
    expect(response.body).not.toContain('provider secret detail');
  });
});
