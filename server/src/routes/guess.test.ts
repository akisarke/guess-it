import { Prisma } from '@prisma/client';
import { describe, expect, test } from 'vitest';
import { gameplayApp, gameplayDatabase, set } from '../test/gameplay.js';
import { guessRoutes } from './guess.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';

describe('source-authorized guesses', () => {
  test.each([
    { source: { kind: 'generated', id: 'set-1' }, questionId: 'foreign', status: 403 },
    { source: { kind: 'daily', id: 'daily-uuid' }, questionId: 'foreign', status: 403 },
    { source: { kind: 'generated', id: 'set-1' }, questionId: 'q3', status: 403, forbidden: true },
    { source: { kind: 'generated', id: 'missing' }, questionId: 'q3', status: 404, missing: true },
    { source: { kind: 'daily', id: 'missing' }, questionId: 'q3', status: 404, missing: true },
  ])('rejects $source.kind/$questionId with $status before answer access', async ({ source, questionId, status, forbidden, missing }) => {
    // Given
    const { prisma, reads, createGuess } = gameplayDatabase();
    if (forbidden) reads.set.mockResolvedValue({ ...set, ownerId: 'other' });
    if (missing) { reads.set.mockResolvedValue(null); reads.daily.mockResolvedValue(null); }
    const { app, cookies } = await gameplayApp(prisma);
    registerHttpErrorHandler(app);
    await app.register(guessRoutes, { prefix: '/api' });
    try {
      // When
      const response = await app.inject({ method: 'POST', url: '/api/guess', cookies, payload: { source, questionId, value: 50 } });
      // Then
      expect(response.statusCode).toBe(status);
      expect(response.json().code).toBe(status === 403 ? 'FORBIDDEN' : 'NOT_FOUND');
      expect(reads.answer).not.toHaveBeenCalled();
      expect(createGuess).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  test('rejects decimal guesses', async () => {
    const { prisma, reads } = gameplayDatabase();
    const { app, cookies } = await gameplayApp(prisma);
    registerHttpErrorHandler(app);
    await app.register(guessRoutes, { prefix: '/api' });
    try {
      const response = await app.inject({ method: 'POST', url: '/api/guess', cookies,
        payload: { source: { kind: 'daily', id: 'daily-uuid' }, questionId: 'q3', value: 50.5 } });
      expect(response.statusCode).toBe(400);
      expect(reads.answer).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  test.each([
    { questionId: 'q3', value: 50 },
    { source: { kind: 'duel', id: 'set-1' }, questionId: 'q3', value: 50 },
    { source: { kind: 'generated', id: '' }, questionId: 'q3', value: 50 },
    { source: { kind: 'daily' }, questionId: 'q3', value: 50 },
  ])('rejects malformed source input %#', async (payload) => {
    // Given
    const { prisma, reads } = gameplayDatabase();
    const { app, cookies } = await gameplayApp(prisma);
    registerHttpErrorHandler(app);
    await app.register(guessRoutes, { prefix: '/api' });
    try {
      // When
      const response = await app.inject({ method: 'POST', url: '/api/guess', cookies, payload });
      // Then
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
      expect(reads.answer).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  test.each(['daily', 'generated'] as const)('returns the answer and existing score semantics for an authorized %s guess', async (kind) => {
    // Given
    const { prisma, reads, createGuess } = gameplayDatabase();
    const { app, cookies } = await gameplayApp(prisma);
    registerHttpErrorHandler(app);
    await app.register(guessRoutes, { prefix: '/api' });
    try {
      // When
      const response = await app.inject({ method: 'POST', url: '/api/guess', cookies,
        payload: { source: { kind, id: kind === 'daily' ? 'daily-uuid' : set.id }, questionId: 'q3', value: 50 } });
      // Then
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ answer: 100, score: 2, direction: 'Too Low', scoreBand: 'medium', napkinMath: 'private explanation' });
      expect(createGuess).toHaveBeenCalledWith({ data: { userId: 'owner', questionId: 'q3', value: 50, score: 2 } });
      const sourceRead = kind === 'daily' ? reads.daily : reads.set;
      expect(sourceRead.mock.invocationCallOrder[0]).toBeLessThan(reads.answer.mock.invocationCallOrder[0]);
    } finally { await app.close(); }
  });

  test('returns 409 when persistence rejects a duplicate authorized guess', async () => {
    // Given
    const { prisma, createGuess } = gameplayDatabase();
    createGuess.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '5.19' }));
    const { app, cookies } = await gameplayApp(prisma);
    await app.register(guessRoutes, { prefix: '/api' });
    try {
      // When
      const response = await app.inject({ method: 'POST', url: '/api/guess', cookies,
        payload: { source: { kind: 'generated', id: set.id }, questionId: 'q3', value: 50 } });
      // Then
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe('CONFLICT');
      expect(response.json()).not.toHaveProperty('answer');
    } finally { await app.close(); }
  });
});
