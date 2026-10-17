import { randomBytes } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';
import { resetPassword } from './password-reset.js';

const now = new Date('2026-09-18T12:00:00.000Z');
const resetToken = randomBytes(32).toString('base64url');

function makePrisma(overrides: {
  token?: { id: string; userId: string; usedAt: Date | null; expiresAt: Date } | null;
  consumeCount?: number;
} = {}) {
  const token = overrides.token === undefined ? {
    id: 'token-1', userId: 'user-1', usedAt: null,
    expiresAt: new Date('2026-09-18T12:30:00.000Z'),
  } : overrides.token;
  const transaction = {
    passwordResetToken: {
      findFirst: vi.fn().mockResolvedValue(token),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.consumeCount ?? 1 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
  return { transaction, $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<boolean>) => callback(transaction)) };
}

describe('resetPassword', () => {
  test('atomically consumes the token, rotates sessions, and clears lockout state', async () => {
    const prisma = makePrisma();

     const consumed = await resetPassword(prisma, { token: resetToken, passwordHash: 'next-hash', now });

    expect(consumed).toBe(true);
    expect(prisma.transaction.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-1', usedAt: null }, data: { usedAt: now },
    });
    expect(prisma.transaction.passwordResetToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tokenHash: expect.any(String), usedAt: null, expiresAt: { gt: now },
        user: { authProvider: 'password', passwordHash: { not: null } },
      }),
    }));
    expect(prisma.transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'next-hash', sessionVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  test('returns false when the token was already consumed', async () => {
    const prisma = makePrisma({ consumeCount: 0 });

     await expect(resetPassword(prisma, { token: randomBytes(32).toString('base64url'), passwordHash: 'next-hash', now })).resolves.toBe(false);
    expect(prisma.transaction.user.update).not.toHaveBeenCalled();
  });

  test('returns false for missing, expired, and non-password tokens', async () => {
     await expect(resetPassword(makePrisma({ token: null }), { token: randomBytes(32).toString('base64url'), passwordHash: 'next-hash', now })).resolves.toBe(false);
     await expect(resetPassword(makePrisma({ token: null }), { token: randomBytes(32).toString('base64url'), passwordHash: 'next-hash', now })).resolves.toBe(false);
  });
});
