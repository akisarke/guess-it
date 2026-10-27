import type { PrismaClient } from '@prisma/client';

// A failed Hack Club login may already have created an empty Hack Club account.
// Move the current anonymous visitor's daily progress onto it without
// overwriting anything the destination account already has.
export async function mergeAnonymousProgress(prisma: PrismaClient, fromUserId: string, toUserId: string) {
  await prisma.$transaction(async (tx) => {
    const guesses = await tx.guess.findMany({ where: { userId: fromUserId } });
    if (guesses.length > 0) {
      await tx.guess.createMany({
        data: guesses.map(({ id, userId, ...guess }) => ({ ...guess, userId: toUserId })),
        skipDuplicates: true,
      });
    }

    const streak = await tx.streak.findUnique({ where: { userId: fromUserId } });
    if (streak) {
      const destinationStreak = await tx.streak.findUnique({ where: { userId: toUserId }, select: { userId: true } });
      if (!destinationStreak) {
        await tx.streak.create({
          data: {
            userId: toUserId,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastPlayedOn: streak.lastPlayedOn,
          },
        });
      }
    }

    const badges = await tx.userBadge.findMany({ where: { userId: fromUserId } });
    if (badges.length > 0) {
      await tx.userBadge.createMany({
        data: badges.map(({ userId, ...badge }) => ({ ...badge, userId: toUserId })),
        skipDuplicates: true,
      });
    }
  });
}
