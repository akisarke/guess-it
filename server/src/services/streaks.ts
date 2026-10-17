import { PrismaClient, Streak } from '@prisma/client';
import { utcDayRange } from './daily-puzzle.js';

export async function updateStreak(
  prisma: PrismaClient,
  userId: string,
  playedDate: Date
): Promise<Streak | null> {
  const day = utcDayRange(playedDate);
  const today = day.gte;

  const existing = await prisma.streak.findUnique({ where: { userId } });
  const puzzle = await prisma.dailyPuzzle.findFirst({ where: { puzzleDate: day } });
  if (!puzzle || puzzle.questionIds.length !== 3) return existing;
  const answered = await prisma.guess.count({
    where: { userId, questionId: { in: puzzle.questionIds } },
  });
  if (answered !== puzzle.questionIds.length) return existing;

  if (!existing) {
    return prisma.streak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastPlayedOn: today,
      },
    });
  }

  const lastPlayed = existing.lastPlayedOn ? new Date(existing.lastPlayedOn) : null;
  lastPlayed?.setUTCHours(0, 0, 0, 0);

  let newStreak: number;
  if (!lastPlayed) {
    newStreak = 1;
  } else {
    const diffDays = Math.floor((today.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return existing;
    } else if (diffDays === 1) {
      newStreak = existing.currentStreak + 1;
    } else {
      newStreak = 1;
    }
  }

  const longest = Math.max(newStreak, existing.longestStreak);

  return prisma.streak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: longest,
      lastPlayedOn: today,
    },
  });
}
