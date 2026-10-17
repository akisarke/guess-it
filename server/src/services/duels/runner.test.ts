import { describe, expect, it, vi } from 'vitest';
import { parseDuelId, parsePlayerId } from 'shared';
import { createDuelState } from './domain.js';
import { DuelCoordinator } from './coordinator.js';
import { DuelRepositoryError } from './repository.js';
import { startDuelRunner } from './runner.js';

describe('startDuelRunner', () => {
  it('hydrates overdue persisted duels and advances their active round', async () => {
    const now = new Date('2026-09-16T12:01:00Z');
    const state = createDuelState({
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
      now: new Date('2026-09-16T12:00:00Z'),
    });
    const findMany = vi.fn().mockResolvedValue([{ id: 'duel-1' }]);
    const prisma = { duel: { findMany } };
    const coordinator = new DuelCoordinator({ now: () => now, loadState: async () => state });
    const tick = vi.spyOn(coordinator, 'tick');
    const stop = startDuelRunner(prisma, coordinator, { intervalMs: 60_000 });

    await vi.waitFor(() => expect(tick).toHaveBeenCalledWith(parseDuelId('duel-1')));

    expect(tick.mock.results[0]?.value).toBeInstanceOf(Promise);
    stop();
  });

  it('treats a STALE_VERSION optimistic-lock conflict as an expected no-op instead of a runner failure', async () => {
    const now = new Date('2026-09-16T12:01:00Z');
    const state = createDuelState({
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
      now: new Date('2026-09-16T12:00:00Z'),
    });
    const findMany = vi.fn().mockResolvedValue([{ id: 'duel-1' }]);
    const prisma = { duel: { findMany } };
    const onError = vi.fn();
    const persistState = vi.fn().mockRejectedValue(new DuelRepositoryError('STALE_VERSION', 'Duel changed before this transition was saved.'));
    const coordinator = new DuelCoordinator({ now: () => now, loadState: async () => state, persistState });
    const stop = startDuelRunner(prisma, coordinator, { intervalMs: 60_000, onError });

    await vi.waitFor(() => expect(persistState).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).not.toHaveBeenCalled();
    stop();
  });

  it('reports real runner failures through onError', async () => {
    const now = new Date('2026-09-16T12:01:00Z');
    const state = createDuelState({
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
      now: new Date('2026-09-16T12:00:00Z'),
    });
    const findMany = vi.fn().mockResolvedValue([{ id: 'duel-1' }]);
    const prisma = { duel: { findMany } };
    const failure = new Error('database unavailable');
    const persistState = vi.fn().mockRejectedValue(failure);
    const coordinator = new DuelCoordinator({ now: () => now, loadState: async () => state, persistState });
    const onError = vi.fn();
    const stop = startDuelRunner(prisma, coordinator, { intervalMs: 60_000, onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
    stop();
  });
});
