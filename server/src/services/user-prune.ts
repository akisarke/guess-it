import type { PrismaClient } from '@prisma/client';
import { removeLocalAvatar } from './avatar-files.js';

export type PruneConfig = Readonly<{
  keepDisplayName: string;
}>;

export type PruneCounts = Readonly<{
  users: number;
  guesses: number;
  streaks: number;
  badges: number;
  queueEntries: number;
  duels: number;
  keptUserId: string;
}>;

export function parsePruneConfig(env: NodeJS.ProcessEnv): PruneConfig {
  if (env.PRUNE_USERS_CONFIRM !== 'delete-all-but-keep-one') throw new Error('PRUNE_USERS_CONFIRM must be exactly delete-all-but-keep-one.');
  const keepDisplayName = env.PRUNE_KEEP_DISPLAY_NAME?.trim();
  if (!keepDisplayName) throw new Error('PRUNE_KEEP_DISPLAY_NAME is required.');
  return { keepDisplayName };
}

export async function pruneUsersKeeping(prisma: PrismaClient, config: PruneConfig, uploadDir: string): Promise<PruneCounts> {
  const keeper = await prisma.user.findUnique({ where: { displayName: config.keepDisplayName }, select: { id: true } });
  // Refuse before touching anything: an unknown name must never mean "delete everyone".
  if (!keeper) throw new Error(`No user is named "${config.keepDisplayName}". Refusing to delete every account.`);

  const others = await prisma.user.findMany({ where: { id: { not: keeper.id } }, select: { id: true, avatarUrl: true } });
  const otherIds = others.map((user) => user.id);
  const notKeeper = { not: keeper.id };

  const counts = await prisma.$transaction(async (tx) => {
    const guesses = await tx.guess.deleteMany({ where: { userId: notKeeper } });
    const streaks = await tx.streak.deleteMany({ where: { userId: notKeeper } });
    const badges = await tx.userBadge.deleteMany({ where: { userId: notKeeper } });
    const queueEntries = await tx.matchmakingQueueEntry.deleteMany({ where: { userId: notKeeper } });
    const duels = await tx.duel.deleteMany({ where: { OR: [{ playerA: notKeeper }, { playerB: notKeeper }] } });
    if (otherIds.length > 0) {
      await tx.userBadge.updateMany({ where: { grantedBy: { in: otherIds } }, data: { grantedBy: null } });
      await tx.question.updateMany({ where: { createdBy: { in: otherIds } }, data: { createdBy: null } });
    }
    const deletedUsers = await tx.user.deleteMany({ where: { id: notKeeper } });
    return { ...countsOf({ guesses, streaks, badges, queueEntries, duels }), users: deletedUsers.count };
  });

  await Promise.all(others.map((user) => removeLocalAvatar(user.avatarUrl, uploadDir)));
  return { ...counts, keptUserId: keeper.id };
}

function countsOf(deleted: {
  guesses: { count: number };
  streaks: { count: number };
  badges: { count: number };
  queueEntries: { count: number };
  duels: { count: number };
}) {
  return {
    guesses: deleted.guesses.count,
    streaks: deleted.streaks.count,
    badges: deleted.badges.count,
    queueEntries: deleted.queueEntries.count,
    duels: deleted.duels.count,
  };
}