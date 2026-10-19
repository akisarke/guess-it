import { expect, test, vi } from 'vitest';
import { gameplayApp, gameplayDatabase, puzzle } from '../test/gameplay.js';
import { puzzleRoutes } from './puzzle.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';

test.each(['/today', '/42'])('preserves daily gameplay fields and adds canonical source metadata at %s', async (url) => {

  const { prisma } = gameplayDatabase();
  vi.spyOn(prisma.dailyPuzzle, 'findFirst').mockResolvedValue(puzzle);
  const { app, cookies } = await gameplayApp(prisma);
  registerHttpErrorHandler(app);
  await app.register(puzzleRoutes);
  try {

    const response = await app.inject({ url, cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: { kind: 'daily', id: 'daily-uuid' },
      puzzle: { id: 'daily-uuid', puzzleNumber: 42, puzzleDate: '2026-09-12T00:00:00.000Z', questionIds: ['q2', 'q3', 'q1'] },
      questions: [{ id: 'q2' }, { id: 'q3' }, { id: 'q1' }], userGuesses: { q3: 2 },
    });
    expect(response.body).not.toContain('napkinMath');
  } finally { await app.close(); }
});

test('keeps the registered archive ordered and answer-free', async () => {

  const { prisma } = gameplayDatabase();
  vi.spyOn(prisma.dailyPuzzle, 'findMany').mockResolvedValue([puzzle]);
  const { app, cookies } = await gameplayApp(prisma);
  registerHttpErrorHandler(app);
  await app.register(puzzleRoutes);
  try {

    const response = await app.inject({ url: '/archive', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ hasMore: false, puzzles: [{ puzzleNumber: 42, questions: [{ id: 'q2' }, { id: 'q3' }, { id: 'q1' }] }] });
    expect(response.body).not.toContain('answer');
    expect(response.body).not.toContain('napkinMath');
  } finally { await app.close(); }
});
