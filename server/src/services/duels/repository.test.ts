import { describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { parseDuelId, parsePlayerId } from 'shared';
import { closeExpiredRound, createDuelState } from './domain.js';
import { loadDuel, saveDuelState } from './repository.js';

describe('duel repository', () => {
  it('loads a duel with ordered submissions and player display fields', async () => {
    const prisma = new PrismaClient();
    const findUnique = vi.spyOn(prisma.duel, 'findUnique').mockResolvedValue(null);

    await expect(loadDuel(prisma, 'duel-1')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'duel-1' },
      include: {
        submissions: { orderBy: [{ roundIndex: 'asc' }, { playerId: 'asc' }] },
        playerAUser: { select: { id: true, displayName: true, avatarUrl: true, bio: true } },
        playerBUser: { select: { id: true, displayName: true, avatarUrl: true, bio: true } },
      },
    });
  });

  it('uses optimistic version matching and upserts each domain submission', async () => {
    const prisma = new PrismaClient();
    const updateMany = vi.spyOn(prisma.duel, 'updateMany').mockResolvedValue({ count: 1 });
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback(prisma));
    vi.spyOn(prisma.duelSubmission, 'upsert').mockResolvedValue({
      id: 'submission-1', duelId: 'duel-1', playerId: 'player-a', roundIndex: 0, value: new Prisma.Decimal(100), score: new Prisma.Decimal(1), createdAt: new Date(),
    });
    const current = createDuelState({
      duelId: parseDuelId('duel-1'),
      players: [
        { playerId: parsePlayerId('player-a'), displayName: 'A', avatarUrl: null },
        { playerId: parsePlayerId('player-b'), displayName: 'B', avatarUrl: null },
      ],
      questions: [
        { id: 'q1', prompt: 'First', unit: 'items', answer: 100 },
        { id: 'q2', prompt: 'Second', unit: 'items', answer: 200 },
        { id: 'q3', prompt: 'Third', unit: 'items', answer: 300 },
      ],
      now: new Date('2026-09-14T12:00:00Z'),
    });

    await saveDuelState(prisma, current, 0);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'duel-1', version: 0 }, data: expect.objectContaining({ version: 0, status: 'question' }) }));
  });

  it('persists timed-out submissions without storing the timeout sentinel as an answer', async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.duel, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback(prisma));
    const upsert = vi.spyOn(prisma.duelSubmission, 'upsert').mockResolvedValue({
      id: 'submission-1', duelId: 'duel-1', playerId: 'player-a', roundIndex: 0, value: null, score: new Prisma.Decimal(1e18), createdAt: new Date(),
    });
    const current = createDuelState({
      duelId: parseDuelId('duel-1'),
      players: [
        { playerId: parsePlayerId('player-a'), displayName: 'A', avatarUrl: null },
        { playerId: parsePlayerId('player-b'), displayName: 'B', avatarUrl: null },
      ],
      questions: [
        { id: 'q1', prompt: 'First', unit: 'items', answer: 100 },
        { id: 'q2', prompt: 'Second', unit: 'items', answer: 200 },
        { id: 'q3', prompt: 'Third', unit: 'items', answer: 300 },
      ],
      now: new Date('2026-09-14T12:00:00Z'),
    });
    const expired = closeExpiredRound(current, new Date('2026-09-14T12:01:00Z'));

    await saveDuelState(prisma, expired, 0);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ value: null }),
      create: expect.objectContaining({ value: null }),
    }));
  });
});
