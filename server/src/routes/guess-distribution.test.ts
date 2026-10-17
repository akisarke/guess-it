import { expect, test, vi } from 'vitest';
import { gameplayApp, gameplayDatabase, savedGuess } from '../test/gameplay.js';
import { guessRoutes } from './guess.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';

test('distribution denies answer access when the viewer has not guessed the generated question', async () => {
  // Given
  const { prisma, reads } = gameplayDatabase();
  const { app, cookies } = await gameplayApp(prisma);
  registerHttpErrorHandler(app);
  await app.register(guessRoutes, { prefix: '/api' });
  try {
    // When
    const response = await app.inject({ url: '/api/puzzle/q3/distribution', cookies });
    // Then
    expect(response.statusCode).toBe(403);
    expect(reads.answer).not.toHaveBeenCalled();
  } finally { await app.close(); }
});

test('distribution accepts generated question IDs after the viewer has guessed', async () => {
  // Given
  const { prisma } = gameplayDatabase();
  const lookup = vi.spyOn(prisma.guess, 'findUnique').mockResolvedValue(savedGuess);
  const { app, cookies } = await gameplayApp(prisma);
  registerHttpErrorHandler(app);
  await app.register(guessRoutes, { prefix: '/api' });
  try {
    // When
    const response = await app.inject({ url: '/api/puzzle/q3/distribution', cookies });
    // Then
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ answer: 100, napkinMath: 'private explanation', userGuess: 50, medianGuess: 50 });
    expect(lookup).toHaveBeenCalledWith({ where: { userId_questionId: { userId: 'owner', questionId: 'q3' } } });
  } finally { await app.close(); }
});

test('guess returns 401 before answer access when signed out', async () => {
  // Given
  const { prisma, reads } = gameplayDatabase();
  const { app } = await gameplayApp(prisma);
  registerHttpErrorHandler(app);
  await app.register(guessRoutes, { prefix: '/api' });
  try {
    // When
    const response = await app.inject({ method: 'POST', url: '/api/guess',
      payload: { source: { kind: 'generated', id: 'set-1' }, questionId: 'q3', value: 50 } });
    // Then
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTHENTICATION_REQUIRED');
    expect(reads.answer).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
