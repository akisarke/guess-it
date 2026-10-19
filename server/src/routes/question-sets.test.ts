import { describe, expect, test } from 'vitest';
import { Prisma } from '@prisma/client';
import { gameplayApp, gameplayDatabase, set, savedGuess } from '../test/gameplay.js';
import { questionSetRoutes } from './question-sets.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';

describe('generated-set gameplay HTTP', () => {
  for (const endpoint of ['play', 'summary']) {
    test.each([
      { viewer: 'signed-out', status: 401 },
      { viewer: 'visitor', status: 403 },
      { viewer: 'missing', status: 404 },
    ])(`GET ${endpoint} returns $status when $viewer`, async ({ viewer, status }) => {

      const { prisma, reads } = gameplayDatabase();
      if (viewer === 'visitor') reads.set.mockResolvedValue({ ...set, ownerId: 'other' });
      if (viewer === 'missing') reads.set.mockResolvedValue(null);
      const { app, cookies } = await gameplayApp(prisma);
      registerHttpErrorHandler(app);
      await app.register(questionSetRoutes, { prefix: '/api/question-sets' });
      try {

        const response = await app.inject({ url: `/api/question-sets/set-1/${endpoint}`, cookies: viewer === 'signed-out' ? {} : cookies });

        expect(response.statusCode).toBe(status);
        expect(response.json().code).toBe(viewer === 'signed-out' ? 'AUTHENTICATION_REQUIRED' : viewer === 'visitor' ? 'FORBIDDEN' : 'NOT_FOUND');
        expect(reads.answer).not.toHaveBeenCalled();
      } finally { await app.close(); }
    });

    test(`GET ${endpoint} returns public ordered questions and owner progress`, async () => {

      const { prisma, reads } = gameplayDatabase();
      const { app, cookies } = await gameplayApp(prisma);
      await app.register(questionSetRoutes, { prefix: '/api/question-sets' });
      try {

        const response = await app.inject({ url: `/api/question-sets/set-1/${endpoint}`, cookies });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ source: { kind: 'generated', id: 'set-1' }, userGuesses: { q3: 2 }, set: { title: 'Scale', completed: false } });
        expect(response.body).not.toContain('answer');
        expect(response.body).not.toContain('napkinMath');
        expect(reads.answer).not.toHaveBeenCalled();
      } finally { await app.close(); }
    });
  }

  test('summary aggregates all three viewer scores when completed', async () => {

    const { prisma, reads } = gameplayDatabase();
    reads.guesses.mockResolvedValue(['q3', 'q1', 'q2'].map((questionId) => ({ ...savedGuess, questionId })));
    const { app, cookies } = await gameplayApp(prisma);
    registerHttpErrorHandler(app);
    await app.register(questionSetRoutes, { prefix: '/api/question-sets' });
    try {

      const response = await app.inject({ url: '/api/question-sets/set-1/summary', cookies });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ completed: true, averageScore: 2, set: { completed: true } });
      expect(response.body).not.toContain('napkinMath');
    } finally { await app.close(); }
  });

  test('summary withholds the aggregate when only some questions have guesses', async () => {

    const { prisma } = gameplayDatabase();
    const { app, cookies } = await gameplayApp(prisma);
    await app.register(questionSetRoutes, { prefix: '/api/question-sets' });
    try {

      const response = await app.inject({ url: '/api/question-sets/set-1/summary', cookies });

      expect(response.json()).toMatchObject({ completed: false, averageScore: null });
    } finally { await app.close(); }
  });

  test('summary averages distinct decimal scores in question order when complete', async () => {

    const { prisma, reads } = gameplayDatabase();
    reads.guesses.mockResolvedValue([
      { ...savedGuess, questionId: 'q1', score: new Prisma.Decimal('3.5') },
      { ...savedGuess, questionId: 'q2', score: new Prisma.Decimal('1.25') },
      { ...savedGuess, questionId: 'q3', score: new Prisma.Decimal('2') },
    ]);
    const { app, cookies } = await gameplayApp(prisma);
    await app.register(questionSetRoutes, { prefix: '/api/question-sets' });
    try {

      const response = await app.inject({ url: '/api/question-sets/set-1/summary', cookies });

      expect(response.json()).toMatchObject({ completed: true, averageScore: 2.25, userGuesses: { q1: 3.5, q2: 1.25, q3: 2 } });
    } finally { await app.close(); }
  });
});
