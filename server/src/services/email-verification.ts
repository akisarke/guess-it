import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { ValidationError } from '../errors/application-error.js';

const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type VerificationPrisma = { emailVerificationToken: { create: (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => Promise<unknown> } };
type VerificationTransaction = {
  emailVerificationToken: {
    findFirst: (args: { where: unknown; select: { id: true; userId: true } }) => Promise<{ id: string; userId: string } | null>;
    updateMany: (args: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => Promise<{ count: number }>;
  };
  user: {
    update: (args: { where: { id: string }; data: { emailVerifiedAt: Date; sessionVersion: { increment: number } } }) => Promise<unknown>;
  };
};
type TransactionalVerificationPrisma = { $transaction: (callback: (transaction: VerificationTransaction) => Promise<string>) => Promise<string> };

export async function createEmailVerificationToken(prisma: VerificationPrisma, userId: string, now: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) } });
  return token;
}

export function consumeEmailVerificationToken(prisma: PrismaClient, rawToken: string, now: Date): Promise<string>;
export function consumeEmailVerificationToken(prisma: TransactionalVerificationPrisma, rawToken: string, now: Date): Promise<string>;
export async function consumeEmailVerificationToken(
  prisma: PrismaClient | TransactionalVerificationPrisma,
  rawToken: string,
  now: Date,
): Promise<string> {
  const tokenHash = hashToken(rawToken);
  return prisma.$transaction(async (transaction) => {
    const token = await transaction.emailVerificationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    if (!token) throw new ValidationError('That verification link is invalid or expired.');

    const consumed = await transaction.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new ValidationError('That verification link is invalid or expired.');

    await transaction.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now, sessionVersion: { increment: 1 } } });
    return token.userId;
  });
}
