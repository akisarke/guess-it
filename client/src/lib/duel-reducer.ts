import type { DuelPlayerView, DuelServerEvent, DuelSnapshot } from 'shared';

export interface DuelClientState {
  readonly snapshot: DuelSnapshot | null;
  readonly lastVersion: number;
  readonly error: string | null;
}

export const initialDuelState: DuelClientState = { snapshot: null, lastVersion: -1, error: null };

function withPlayerState(snapshot: DuelSnapshot, playerId: string, state: DuelPlayerView['state']): DuelSnapshot {
  const players: readonly [DuelPlayerView, DuelPlayerView] = snapshot.players[0].playerId === playerId
    ? [{ ...snapshot.players[0], state }, snapshot.players[1]]
    : [snapshot.players[0], { ...snapshot.players[1], state }];
  return { ...snapshot, players };
}

export function reduceDuelState(state: DuelClientState, event: DuelServerEvent): DuelClientState {
  if (event.version < state.lastVersion) return state;
  switch (event.type) {
    case 'duel.snapshot':
      return { snapshot: event.snapshot, lastVersion: event.version, error: null };
    case 'duel.player_status':
      return state.snapshot ? { ...state, snapshot: withPlayerState(state.snapshot, event.playerId, event.state), lastVersion: event.version } : state;
    case 'duel.answer_locked':
      return state.snapshot ? { ...state, snapshot: withPlayerState(state.snapshot, event.playerId, 'locked'), lastVersion: event.version } : state;
    case 'duel.round_reveal':
      return state.snapshot ? { ...state, snapshot: { ...state.snapshot, phase: 'reveal', roundIndex: event.roundIndex, reveal: event.reveal }, lastVersion: event.version } : state;
    case 'duel.round_started':
      return state.snapshot ? { ...state, snapshot: { ...state.snapshot, phase: 'question', roundIndex: event.roundIndex, roundDeadline: event.roundDeadline, currentQuestion: event.question, reveal: null }, lastVersion: event.version } : state;
    case 'duel.completed':
      return state.snapshot ? { ...state, snapshot: { ...state.snapshot, phase: 'completed', winner: event.winner }, lastVersion: event.version } : state;
    case 'duel.forfeited':
      return state.snapshot ? { ...state, snapshot: { ...state.snapshot, phase: 'forfeited', winner: event.winner }, lastVersion: event.version } : state;
    case 'duel.error':
      return { ...state, lastVersion: Math.max(state.lastVersion, event.version), error: event.message };
    default:
      return event satisfies never;
  }
}
