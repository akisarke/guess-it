import type { QuestionPublic } from './types.js';
import type { DuelId, PlayerId } from './generated-sets.js';

export type DuelPhase = 'waiting' | 'question' | 'reveal' | 'completed' | 'forfeited';
export type PlayerRoundState = 'waiting' | 'locked' | 'timed_out';

export interface DuelPlayerView {
  readonly playerId: PlayerId;
readonly displayName: string;
readonly avatarUrl: string | null;
readonly bio?: string | null;
  readonly state: PlayerRoundState;
  readonly score: number;
}

export interface DuelReveal {
readonly answer: number;
readonly guesses: readonly [number | null, number | null];
readonly scores: readonly [number | null, number | null];
}

export interface DuelSnapshot {
  readonly duelId: DuelId;
  readonly players: readonly [DuelPlayerView, DuelPlayerView];
  readonly currentQuestion: QuestionPublic | null;
  readonly phase: DuelPhase;
  readonly roundIndex: number;
  readonly roundDeadline: string | null;
  readonly reveal: DuelReveal | null;
  readonly winner: PlayerId | 'draw' | null;
  readonly version: number;
}

export type DuelClientCommand =
  | { readonly type: 'duel.subscribe'; readonly duelId: DuelId }
  | { readonly type: 'duel.submit_answer'; readonly duelId: DuelId; readonly roundIndex: number; readonly value: number }
  | { readonly type: 'duel.leave'; readonly duelId: DuelId };

export type DuelServerEvent =
  | { readonly type: 'duel.snapshot'; readonly duelId: DuelId; readonly version: number; readonly snapshot: DuelSnapshot | null }
  | { readonly type: 'duel.player_status'; readonly duelId: DuelId; readonly version: number; readonly playerId: PlayerId; readonly state: PlayerRoundState }
  | { readonly type: 'duel.answer_locked'; readonly duelId: DuelId; readonly version: number; readonly playerId: PlayerId; readonly roundIndex: number }
  | { readonly type: 'duel.round_reveal'; readonly duelId: DuelId; readonly version: number; readonly roundIndex: number; readonly reveal: DuelReveal | null }
  | { readonly type: 'duel.round_started'; readonly duelId: DuelId; readonly version: number; readonly roundIndex: number; readonly roundDeadline: string; readonly question: QuestionPublic | null }
  | { readonly type: 'duel.completed'; readonly duelId: DuelId; readonly version: number; readonly winner: PlayerId | 'draw' | null }
  | { readonly type: 'duel.forfeited'; readonly duelId: DuelId; readonly version: number; readonly winner: PlayerId | 'draw' | null }
  | { readonly type: 'duel.error'; readonly duelId: DuelId; readonly version: number; readonly code: string; readonly message: string };

export interface DuelResponse {
  readonly duelId: DuelId;
  readonly snapshot: DuelSnapshot;
}
