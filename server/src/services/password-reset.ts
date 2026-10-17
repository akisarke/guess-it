import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPasswordResetToken(prisma: PrismaClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return token;
}

export function hashPasswordResetToken(token: string): string {
  return hashToken(token);
}

type PasswordResetTransaction = {
  passwordResetToken: {
    findFirst: (args: { where: unknown; select: { id: true; userId: true } }) => Promise<{ id: string; userId: string } | null>;
    updateMany: (args: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => Promise<{ count: number }>;
  };
  user: {
    update: (args: { where: { id: string }; data: { passwordHash: string; sessionVersion: { increment: number }; failedLoginAttempts: number; lockedUntil: null } }) => Promise<unknown>;
  };
};
type PasswordResetPrisma = { $transaction: (callback: (transaction: PasswordResetTransaction) => Promise<boolean>) => Promise<boolean> };

export function resetPassword(prisma: PrismaClient, input: Readonly<{ token: string; passwordHash: string; now: Date }>): Promise<boolean>;
export function resetPassword(prisma: PasswordResetPrisma, input: Readonly<{ token: string; passwordHash: string; now: Date }>): Promise<boolean>;
export async function resetPassword(
  prisma: PrismaClient | PasswordResetPrisma,
  input: Readonly<{ token: string; passwordHash: string; now: Date }>,
): Promise<boolean> {
  const tokenHash = hashToken(input.token);
  return prisma.$transaction(async (transaction) => {
    const resetToken = await transaction.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: input.now },
        user: { authProvider: 'password', passwordHash: { not: null } },
      },
      select: { id: true, userId: true },
    });
    if (!resetToken) return false;

    const consumed = await transaction.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: input.now },
    });
    if (consumed.count !== 1) return false;

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: input.passwordHash, sessionVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null },
    });
    return true;
  });
}
