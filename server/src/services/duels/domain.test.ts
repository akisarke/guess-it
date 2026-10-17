import { describe, expect, it } from 'vitest';
import { parseDuelId, parsePlayerId } from 'shared';
import {
  DUEL_RECONNECT_GRACE_MS,
  DUEL_REVEAL_MS,
  DUEL_ROUND_TIMEOUT_MS,
  DUEL_TIMEOUT_SCORE,
  DuelDomainError,
  advanceReveal,
  closeExpiredRound,
  createDuelState,
  forfeitDisconnectedPlayer,
  markDisconnected,
  reconnectPlayer,
  submitDuelAnswer,
  toDuelSnapshot,
} from './domain.js';

const start = new Date('2026-09-14T12:00:00.000Z');
const playerA = { playerId: parsePlayerId('player-a'), displayName: 'A', avatarUrl: null };
const playerB = { playerId: parsePlayerId('player-b'), displayName: 'B', avatarUrl: null };

function initial() {
  return createDuelState({
    duelId: parseDuelId('duel-1'),
    players: [playerA, playerB],
    questions: [
      { id: 'q1', prompt: 'First', unit: 'items', answer: 100 },
      { id: 'q2', prompt: 'Second', unit: 'items', answer: 200 },
      { id: 'q3', prompt: 'Third', unit: 'items', answer: 300 },
    ],
    now: start,
  });
}

describe('duel domain', () => {
  it('starts on the first question and hides answers before reveal', () => {
    const snapshot = toDuelSnapshot(initial());
    expect(snapshot.phase).toBe('question');
    expect(snapshot.currentQuestion?.id).toBe('q1');
    expect(snapshot.reveal).toBeNull();
  });

  it('waits after the first lock and reveals after the second lock', () => {
    const first = submitDuelAnswer(initial(), playerA.playerId, 0, 90, start);
    expect(toDuelSnapshot(first).phase).toBe('question');
    const second = submitDuelAnswer(first, playerB.playerId, 0, 110, start);
    expect(toDuelSnapshot(second)).toMatchObject({ phase: 'reveal', roundIndex: 0, reveal: { answer: 100, guesses: [90, 110], scores: [1.11, 1.1] } });
  });

  it('rejects duplicate and stale submissions', () => {
    const first = submitDuelAnswer(initial(), playerA.playerId, 0, 90, start);
    expect(() => submitDuelAnswer(first, playerA.playerId, 0, 95, start)).toThrowError(new DuelDomainError('DUPLICATE_SUBMISSION', 'This player already locked an answer.'));
    expect(() => submitDuelAnswer(first, playerB.playerId, 1, 200, start)).toThrowError(new DuelDomainError('STALE_ROUND', 'This duel round is no longer active.'));
  });

  it('penalizes both missing answers when the sixty-second deadline closes', () => {
    const state = closeExpiredRound(initial(), new Date(start.getTime() + DUEL_ROUND_TIMEOUT_MS));
    expect(toDuelSnapshot(state).reveal?.scores).toEqual([DUEL_TIMEOUT_SCORE, DUEL_TIMEOUT_SCORE]);
    expect(toDuelSnapshot(state).players.map((player) => player.score)).toEqual([DUEL_TIMEOUT_SCORE, DUEL_TIMEOUT_SCORE]);
  });

  it('keeps cumulative timeout display bounded after multiple timed-out rounds', () => {
    let state = closeExpiredRound(initial(), new Date(start.getTime() + DUEL_ROUND_TIMEOUT_MS));
    state = advanceReveal(state, new Date(start.getTime() + DUEL_ROUND_TIMEOUT_MS + DUEL_REVEAL_MS));
    state = closeExpiredRound(state, new Date(start.getTime() + DUEL_ROUND_TIMEOUT_MS + DUEL_REVEAL_MS + DUEL_ROUND_TIMEOUT_MS));
    expect(toDuelSnapshot(state).players.map((player) => player.score)).toEqual([DUEL_TIMEOUT_SCORE, DUEL_TIMEOUT_SCORE]);
  });

  it('advances through five-second reveal and picks the lower average', () => {
    let state = submitDuelAnswer(initial(), playerA.playerId, 0, 100, start);
    state = submitDuelAnswer(state, playerB.playerId, 0, 150, start);
    state = advanceReveal(state, new Date(start.getTime() + DUEL_REVEAL_MS));
    expect(state.roundIndex).toBe(1);
    state = submitDuelAnswer(state, playerA.playerId, 1, 200, new Date(start.getTime() + DUEL_REVEAL_MS));
    state = submitDuelAnswer(state, playerB.playerId, 1, 300, new Date(start.getTime() + DUEL_REVEAL_MS));
    state = advanceReveal(state, new Date(start.getTime() + DUEL_REVEAL_MS * 2));
    state = submitDuelAnswer(state, playerA.playerId, 2, 300, new Date(start.getTime() + DUEL_REVEAL_MS * 2));
    state = submitDuelAnswer(state, playerB.playerId, 2, 600, new Date(start.getTime() + DUEL_REVEAL_MS * 2));
    state = advanceReveal(state, new Date(start.getTime() + DUEL_REVEAL_MS * 3));
    expect(toDuelSnapshot(state).winner).toBe(playerA.playerId);
  });

  it('reports an exact draw when cumulative averages match', () => {
    let state = submitDuelAnswer(initial(), playerA.playerId, 0, 100, start);
    state = submitDuelAnswer(state, playerB.playerId, 0, 100, start);
    state = advanceReveal(state, new Date(start.getTime() + DUEL_REVEAL_MS));
    state = submitDuelAnswer(state, playerA.playerId, 1, 200, start);
    state = submitDuelAnswer(state, playerB.playerId, 1, 200, start);
    state = advanceReveal(state, new Date(start.getTime() + DUEL_REVEAL_MS * 2));
    state = submitDuelAnswer(state, playerA.playerId, 2, 300, start);
    state = submitDuelAnswer(state, playerB.playerId, 2, 300, start);
    state = advanceReveal(state, new Date(start.getTime() + DUEL_REVEAL_MS * 3));
    expect(toDuelSnapshot(state).winner).toBe('draw');
  });

  it('allows reconnect within twenty seconds and forfeits after the grace period', () => {
    const disconnected = markDisconnected(initial(), playerA.playerId, start);
    const reconnected = reconnectPlayer(disconnected, playerA.playerId, new Date(start.getTime() + DUEL_RECONNECT_GRACE_MS - 1));
    expect(reconnected.disconnectedUntil[0]).toBeNull();
    const expired = markDisconnected(initial(), playerA.playerId, start);
    const forfeited = forfeitDisconnectedPlayer(expired, new Date(start.getTime() + DUEL_RECONNECT_GRACE_MS));
    expect(toDuelSnapshot(forfeited)).toMatchObject({ phase: 'forfeited', winner: playerB.playerId });
  });
});
