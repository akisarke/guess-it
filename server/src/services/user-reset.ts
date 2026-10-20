import type { PrismaClient } from '@prisma/client';
import { readdir, unlink } from 'node:fs/promises';
import { hashPassword } from './passwords.js';
import { localAvatarPath } from './avatar-files.js';

export type ResetConfig = {
  displayName: string;
  email: string;
  password: string;
  createdAt: Date;
};

export type ResetCounts = {
  userBadges: number;
  guesses: number;
  streaks: number;
  queueEntries: number;
  matches: number;
  resetTokens: number;
  users: number;
  ownerId: string;
};

export function parseResetConfig(env: NodeJS.ProcessEnv): ResetConfig {
  if (env.RESET_USERS_CONFIRM !== 'delete-all-users') throw new Error('RESET_USERS_CONFIRM must be exactly delete-all-users.');
  const email = env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('OWNER_EMAIL is required.');
  if (!env.OWNER_PASSWORD) throw new Error('OWNER_PASSWORD is required.');
  return {
    displayName: env.OWNER_DISPLAY_NAME?.trim() || 'akisarke',
    email,
    password: env.OWNER_PASSWORD,
    createdAt: new Date('2026-09-04T00:00:00.000Z'),
  };
}

async function removeLocalAvatars(uploadDir: string): Promise<void> {
  let files: string[] = [];
  try {
    files = await readdir(uploadDir);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  await Promise.all(files.filter((file) => /\.(?:gif|jpg|png|webp)$/.test(file)).map(async (file) => {
    const path = localAvatarPath(`/uploads/avatars/${file}`, uploadDir);
    if (path) await unlink(path);
  }));
}

export async function resetUsers(prisma: PrismaClient, config: ResetConfig, uploadDir: string): Promise<ResetCounts> {
  const passwordHash = await hashPassword(config.password);
  let counts: Omit<ResetCounts, 'ownerId'>;
  const owner = await prisma.$transaction(async (tx) => {
    const userBadges = await tx.userBadge.deleteMany();
    const guesses = await tx.guess.deleteMany();
    const streaks = await tx.streak.deleteMany();
    const queueEntries = await tx.matchmakingQueueEntry.deleteMany();
    const matches = await tx.duel.deleteMany();
    const resetTokens = await tx.passwordResetToken.deleteMany();
    await tx.question.updateMany({ where: { createdBy: { not: null } }, data: { createdBy: null } });
    const deletedUsers = await tx.user.deleteMany();
    const createdOwner = await tx.user.create({
      data: {
        displayName: config.displayName,
        email: config.email,
        passwordHash,
        authProvider: 'password',
        isOwner: true,
        createdAt: config.createdAt,
      },
    });
    await tx.userBadge.create({ data: { userId: createdOwner.id, badgeId: 'owner', isPinned: true, pinnedAt: config.createdAt } });
    counts = { userBadges: userBadges.count, guesses: guesses.count, streaks: streaks.count, queueEntries: queueEntries.count, matches: matches.count, resetTokens: resetTokens.count, users: deletedUsers.count };
    return createdOwner;
  });
  await removeLocalAvatars(uploadDir);
  return { ...counts!, ownerId: owner.id };
}
