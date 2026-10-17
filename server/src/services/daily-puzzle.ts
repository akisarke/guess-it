import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { selectDailyCatalogQuestions } from './question-catalog.js';

export function utcDayRange(now: Date) {
  const gte = new Date(now);
  gte.setUTCHours(0, 0, 0, 0);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

export async function getTodayPuzzle(prisma: PrismaClient, now = new Date()) {
  const puzzleDate = utcDayRange(now);
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await prisma.dailyPuzzle.findFirst({ where: { puzzleDate } });
    if (existing) return existing;

    try {
      return await prisma.$transaction(async (tx) => {
        const latest = await tx.dailyPuzzle.findFirst({ orderBy: { puzzleNumber: 'desc' } });
        const questionIds = await selectDailyCatalogQuestions(tx, now);
        return tx.dailyPuzzle.create({
          data: {
            puzzleNumber: (latest?.puzzleNumber ?? 0) + 1,
            puzzleDate: puzzleDate.gte,
            questionIds: [...questionIds],
          },
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      if (attempt === 2) throw error;
    }
  }
  return null;
}
