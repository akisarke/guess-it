import { describe, expect, it } from 'vitest';
import { parseDuelId, parsePlayerId, type DuelSnapshot } from 'shared';
import { initialDuelState, reduceDuelState } from './duel-reducer';

const snapshot: DuelSnapshot = {
  duelId: parseDuelId('duel-1'),
  players: [
    { playerId: parsePlayerId('a'), displayName: 'A', avatarUrl: null, state: 'waiting' as const, score: 0 },
    { playerId: parsePlayerId('b'), displayName: 'B', avatarUrl: null, state: 'waiting' as const, score: 0 },
  ],
  currentQuestion: { id: 'q1', prompt: 'First', unit: 'items' }, phase: 'question', roundIndex: 0,
  roundDeadline: '2026-09-14T12:01:00Z', reveal: null, winner: null, version: 1,
};

describe('reduceDuelState', () => {
  it('replaces snapshots and ignores stale versions', () => {
    const current = reduceDuelState(initialDuelState, { type: 'duel.snapshot', duelId: snapshot.duelId, version: 1, snapshot });
    const stale = reduceDuelState(current, { type: 'duel.completed', duelId: snapshot.duelId, version: 0, winner: 'draw' });
    expect(stale).toEqual(current);
  });

  it('tracks locks, reveals, and completion', () => {
    const locked = reduceDuelState(initialDuelState, { type: 'duel.snapshot', duelId: snapshot.duelId, version: 1, snapshot });
    const withLock = reduceDuelState(locked, { type: 'duel.answer_locked', duelId: snapshot.duelId, version: 2, playerId: parsePlayerId('a'), roundIndex: 0 });
const reveal = reduceDuelState(withLock, { type: 'duel.round_reveal', duelId: snapshot.duelId, version: 3, roundIndex: 0, reveal: { answer: 100, guesses: [90, 110], scores: [1, 2] } });
    const completed = reduceDuelState(reveal, { type: 'duel.completed', duelId: snapshot.duelId, version: 4, winner: parsePlayerId('a') });
    expect(completed.snapshot?.phase).toBe('completed');
    expect(completed.snapshot?.winner).toBe('a');
  });
});
