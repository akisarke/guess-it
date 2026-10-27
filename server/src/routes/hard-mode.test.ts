import { expect, test, vi } from 'vitest';
import { gameplayApp, gameplayDatabase, puzzle, questions } from '../test/gameplay.js';
import { hardModeRoutes } from './hard-mode.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { utcDayRange } from '../services/daily-puzzle.js';

const todayStart = utcDayRange(new Date()).gte;
const pastPuzzle = { ...puzzle, puzzleDate: new Date(todayStart.getTime() - 86_400_000) };
const todayPuzzle = { ...puzzle, id: 'today-uuid', puzzleDate: todayStart, questionIds: ['q9'] };

async function hardModeApp(prisma: ReturnType<typeof gameplayDatabase>['prisma']) {
  const { app, cookies } = await gameplayApp(prisma);
  registerHttpErrorHandler(app);
  await app.register(hardModeRoutes, { prefix: '/api/hard-mode' });
  return { app, cookies };
}

test('returns a random past puzzle without answers and skips played puzzles', async () => {
  const { prisma } = gameplayDatabase();
  const extraQuestions = ['q4', 'q5', 'q6'].map((id) => ({ ...questions[0]!, id, prompt: `Estimate ${id}` }));
  const unplayedPuzzle = { ...pastPuzzle, id: 'daily-2', puzzleNumber: 43, questionIds: ['q4', 'q5', 'q6'] };
  vi.spyOn(prisma.dailyPuzzle, 'findMany')
    .mockResolvedValueOnce([pastPuzzle, unplayedPuzzle] as never)
    .mockResolvedValueOnce([todayPuzzle] as never);
  vi.spyOn(prisma.guess, 'findMany').mockResolvedValue([{ questionId: 'q3' }] as never);
  vi.spyOn(prisma.question, 'findMany').mockResolvedValue([...questions, ...extraQuestions] as never);
  const { app, cookies } = await hardModeApp(prisma);

  try {
    const response = await app.inject({ url: '/api/hard-mode/puzzle', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      puzzleNumber: 43,
      questions: [{ id: 'q4' }, { id: 'q5' }, { id: 'q6' }],
    });
    expect(response.body).not.toContain('answer');
    expect(response.body).not.toContain('napkinMath');
  } finally {
    await app.close();
  }
});

test('never offers a puzzle the player already guessed as a daily', async () => {
  const { prisma } = gameplayDatabase();
  const extraQuestions = ['q4', 'q5', 'q6'].map((id) => ({ ...questions[0]!, id, prompt: `Estimate ${id}` }));
  const unplayedPuzzle = { ...pastPuzzle, id: 'daily-2', puzzleNumber: 43, questionIds: ['q4', 'q5', 'q6'] };
  vi.spyOn(prisma.dailyPuzzle, 'findMany')
    .mockResolvedValueOnce([pastPuzzle, unplayedPuzzle] as never)
    .mockResolvedValueOnce([todayPuzzle] as never);
  vi.spyOn(prisma.guess, 'findMany').mockResolvedValue([{ questionId: 'q3' }] as never);
  vi.spyOn(prisma.question, 'findMany').mockResolvedValue([...questions, ...extraQuestions] as never);
  const { app, cookies } = await hardModeApp(prisma);

  try {
    const response = await app.inject({ url: '/api/hard-mode/puzzle?exclude=43', cookies });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe('NOT_FOUND');
  } finally {
    await app.close();
  }
});

test('never offers a puzzle containing a question already seen in hard mode', async () => {
  const { prisma } = gameplayDatabase();
  const extraQuestions = ['q4', 'q5', 'q6'].map((id) => ({ ...questions[0]!, id, prompt: `Estimate ${id}` }));
  const unplayedPuzzle = { ...pastPuzzle, id: 'daily-2', puzzleNumber: 43, questionIds: ['q4', 'q5', 'q6'] };
  vi.spyOn(prisma.dailyPuzzle, 'findMany')
    .mockResolvedValueOnce([pastPuzzle, unplayedPuzzle] as never)
    .mockResolvedValueOnce([todayPuzzle] as never);
  vi.spyOn(prisma.guess, 'findMany').mockResolvedValue([{ questionId: 'q3' }] as never);
  vi.spyOn(prisma.question, 'findMany').mockResolvedValue([...questions, ...extraQuestions] as never);
  const { app, cookies } = await hardModeApp(prisma);

  try {
    const response = await app.inject({ url: '/api/hard-mode/puzzle?excludeQuestions=q4', cookies });

    expect(response.statusCode).toBe(404);
  } finally {
    await app.close();
  }
});

test('scores a past puzzle guess without saving it', async () => {
  const { prisma, createGuess } = gameplayDatabase();
  vi.spyOn(prisma.dailyPuzzle, 'findFirst')
    .mockResolvedValueOnce(pastPuzzle as never)
    .mockResolvedValueOnce(null);
  const { app, cookies } = await hardModeApp(prisma);

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/hard-mode/guess',
      cookies,
      payload: { questionId: 'q3', value: 50 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ score: 2, answer: 100, direction: 'Too Low', scoreBand: 'medium', distribution: { answer: 100, userGuess: 50 } });
    expect(createGuess).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

test('rejects questions that are also in today’s puzzle', async () => {
  const { prisma } = gameplayDatabase();
  vi.spyOn(prisma.dailyPuzzle, 'findFirst')
    .mockResolvedValueOnce(pastPuzzle as never)
    .mockResolvedValueOnce(todayPuzzle as never);
  const { app, cookies } = await hardModeApp(prisma);

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/hard-mode/guess',
      cookies,
      payload: { questionId: 'q3', value: 50 },
    });

    expect(response.statusCode).toBe(403);
  } finally {
    await app.close();
  }
});

test('explains that nothing can be replayed before any daily puzzle has passed', async () => {
  const { prisma } = gameplayDatabase();
  vi.spyOn(prisma.dailyPuzzle, 'findMany')
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([todayPuzzle] as never);
  const { app, cookies } = await hardModeApp(prisma);

  try {
    const response = await app.inject({ url: '/api/hard-mode/puzzle', cookies });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatch(/no past puzzles/i);
  } finally {
    await app.close();
  }
});
