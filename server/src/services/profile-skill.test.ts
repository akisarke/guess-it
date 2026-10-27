import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { getProfileSkill } from './profile-skill.js';

function prismaWith(guesses: { questionId: string; score: number }[], puzzles: { puzzleDate: Date; questionIds: string[] }[]) {
  const prisma = new PrismaClient();
  vi.spyOn(prisma.guess, 'findMany').mockResolvedValue(
    guesses.map((guess) => ({ ...guess, score: new Prisma.Decimal(guess.score) })) as never,
  );
  vi.spyOn(prisma.dailyPuzzle, 'findMany').mockResolvedValue(puzzles as never);
  return prisma;
}

describe('getProfileSkill', () => {
  it('summarises daily guesses and ignores ones outside a daily puzzle', async () => {
    const prisma = prismaWith(
      [
        { questionId: 'a1', score: 1.2 },
        { questionId: 'a2', score: 2.8 },
        { questionId: 'b1', score: 1.05 },
        { questionId: 'generated', score: 40 },
      ],
      [
        { puzzleDate: new Date('2026-10-01T00:00:00Z'), questionIds: ['a1', 'a2', 'a3'] },
        { puzzleDate: new Date('2026-10-02T00:00:00Z'), questionIds: ['b1', 'b2', 'b3'] },
      ],
    );

    await expect(getProfileSkill(prisma, 'user-1')).resolves.toEqual({
      questionsPlayed: 3,
      averageMiss: 1.68,
      bestMiss: 1.05,
      recentDays: [
        { date: '2026-10-01T00:00:00.000Z', averageMiss: 2 },
        { date: '2026-10-02T00:00:00.000Z', averageMiss: 1.05 },
      ],
    });
  });

  it('returns an empty summary for someone who has not played', async () => {
    const prisma = prismaWith([], []);
    await expect(getProfileSkill(prisma, 'user-1')).resolves.toEqual({ questionsPlayed: 0, averageMiss: null, bestMiss: null, recentDays: [] });
  });
});
