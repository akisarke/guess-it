import { PrismaClient } from '@prisma/client';
import { describe, expect, test, vi } from 'vitest';
import { recordFailedPasswordLogin } from './login-state.js';

describe('recordFailedPasswordLogin', () => {
  test('returns no state when an active lock wins the atomic update race', async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([]);

    const result = await recordFailedPasswordLogin(prisma, 'user-1', new Date('2026-09-18T12:00:00.000Z'));

    expect(result).toBeNull();
  });
});
