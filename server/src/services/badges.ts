import { PrismaClient } from '@prisma/client';
import { utcDayRange } from './daily-puzzle.js';
import { createNotification } from './notifications.js';

export async function checkAndAwardBadges(
  prisma: PrismaClient,
  userId: string,
  questionId: string,
  score: number
): Promise<void> {
  if (score === 1.0) {
    await awardBadge(prisma, userId, 'exact');
  }

  const day = utcDayRange(new Date());
  const puzzle = await prisma.dailyPuzzle.findFirst({ where: { puzzleDate: day } });
  const todayGuesses = puzzle ? await prisma.guess.findMany({
    where: {
      userId,
      questionId: { in: puzzle.questionIds },
    },
  }) : [];

  if (puzzle?.questionIds.includes(questionId) && todayGuesses.length === 3) {
    const avg = todayGuesses.reduce((sum, g) => sum + Number(g.score), 0) / todayGuesses.length;
    if (avg < 1.1) {
      await awardBadge(prisma, userId, 'sharp');
    }
  }

  const streak = await prisma.streak.findUnique({ where: { userId } });
  if (streak) {
    if (streak.currentStreak >= 7) await awardBadge(prisma, userId, 'streak7');
    if (streak.currentStreak >= 30) await awardBadge(prisma, userId, 'streak30');
  }
}

export async function awardBadge(
  prisma: PrismaClient,
  userId: string,
  badgeId: string,
  grantedBy?: string,
  note?: string
): Promise<boolean> {
  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId } },
  });

  if (existing) return false;

  const badge = await prisma.badge.findUnique({ where: { id: badgeId }, select: { name: true } });
  await prisma.userBadge.create({
    data: {
      userId,
      badgeId,
      grantedBy,
      note,
    },
  });

  if (badge) {
    try {
      await createNotification(prisma, {
        userId,
        type: 'badge_awarded',
        title: 'New badge earned',
        message: `You earned the ${badge.name} badge.`,
        actionUrl: '/profile',
        actionLabel: 'View profile',
      });
    } catch (error) {
      console.error('Failed to create badge notification', error);
    }
  }

  return true;
}
