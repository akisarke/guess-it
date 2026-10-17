import { describe, expect, it, vi } from 'vitest';
import { parseDuelId, parsePlayerId } from 'shared';
import { createDuelState } from './domain.js';
import { DuelCoordinator } from './coordinator.js';

const now = new Date('2026-09-14T12:00:00Z');

function state() {
  return createDuelState({
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
    now,
  });
}

describe('DuelCoordinator', () => {
  it('loads a persisted duel before the first subscription', async () => {
    const coordinator = new DuelCoordinator({
      now: () => now,
      loadState: async () => state(),
    });
    const received: string[] = [];

    await coordinator.subscribe(parseDuelId('duel-1'), parsePlayerId('player-a'), (event) => received.push(JSON.stringify(event)));

    expect(received).toHaveLength(1);
    expect(received[0]).toContain('duel.snapshot');
  });

  it('sends a sanitized snapshot on subscribe and broadcasts committed transitions', async () => {
    const persistState = vi.fn().mockResolvedValue(undefined);
    const coordinator = new DuelCoordinator({ now: () => now, persistState });
    coordinator.register(state());
    const received: string[] = [];
    const sink = (event: unknown) => received.push(JSON.stringify(event));

    await coordinator.subscribe(parseDuelId('duel-1'), parsePlayerId('player-a'), sink);
    await coordinator.handle({ type: 'duel.submit_answer', duelId: parseDuelId('duel-1'), roundIndex: 0, value: 90 }, parsePlayerId('player-a'));

    expect(received.some((event) => event.includes('duel.snapshot'))).toBe(true);
    expect(received.some((event) => event.includes('duel.answer_locked'))).toBe(true);
    expect(received.every((event) => !event.includes('"answer":100'))).toBe(true);
    expect(persistState).toHaveBeenCalled();
  });

  it('ignores no implicit stale transition and emits a typed error for duplicate locks', async () => {
    const coordinator = new DuelCoordinator({ now: () => now });
    coordinator.register(state());
    const received: string[] = [];
    const sink = (event: unknown) => received.push(JSON.stringify(event));
    await coordinator.subscribe(parseDuelId('duel-1'), parsePlayerId('player-a'), sink);
     await coordinator.handle({ type: 'duel.submit_answer', duelId: parseDuelId('duel-1'), roundIndex: 0, value: 90 }, parsePlayerId('player-a'));
     await coordinator.handle({ type: 'duel.submit_answer', duelId: parseDuelId('duel-1'), roundIndex: 0, value: 95 }, parsePlayerId('player-a'));

    expect(received.at(-1)).toContain('DUPLICATE_SUBMISSION');
  });
});
