import type { QuestionPublic } from './types.js';
import type { DuelId, PlayerId } from './generated-sets.js';

export type DuelPhase = 'waiting' | 'question' | 'reveal' | 'completed' | 'forfeited';
export type PlayerRoundState = 'waiting' | 'locked' | 'timed_out';

export interface DuelPlayerView {
  playerId: PlayerId;
displayName: string;
avatarUrl: string | null;
bio?: string | null;
  state: PlayerRoundState;
  score: number;
}

export interface DuelReveal {
answer: number;
guesses: readonly [number | null, number | null];
scores: readonly [number | null, number | null];
}

export interface DuelSnapshot {
  duelId: DuelId;
  players: readonly [DuelPlayerView, DuelPlayerView];
  currentQuestion: QuestionPublic | null;
  phase: DuelPhase;
  roundIndex: number;
  roundDeadline: string | null;
  reveal: DuelReveal | null;
  winner: PlayerId | 'draw' | null;
  version: number;
}

export type DuelClientCommand =
  | { type: 'duel.subscribe'; duelId: DuelId }
  | { type: 'duel.submit_answer'; duelId: DuelId; roundIndex: number; value: number }
  | { type: 'duel.leave'; duelId: DuelId };

export type DuelServerEvent =
  | { type: 'duel.snapshot'; duelId: DuelId; version: number; snapshot: DuelSnapshot | null }
  | { type: 'duel.player_status'; duelId: DuelId; version: number; playerId: PlayerId; state: PlayerRoundState }
  | { type: 'duel.answer_locked'; duelId: DuelId; version: number; playerId: PlayerId; roundIndex: number }
  | { type: 'duel.round_reveal'; duelId: DuelId; version: number; roundIndex: number; reveal: DuelReveal | null }
  | { type: 'duel.round_started'; duelId: DuelId; version: number; roundIndex: number; roundDeadline: string; question: QuestionPublic | null }
  | { type: 'duel.completed'; duelId: DuelId; version: number; winner: PlayerId | 'draw' | null }
  | { type: 'duel.forfeited'; duelId: DuelId; version: number; winner: PlayerId | 'draw' | null }
  | { type: 'duel.error'; duelId: DuelId; version: number; code: string; message: string };

export interface DuelResponse {
  duelId: DuelId;
  snapshot: DuelSnapshot;
}
