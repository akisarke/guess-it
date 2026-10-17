import type { DuelPhase, DuelPlayerView, DuelReveal, DuelSnapshot, PlayerRoundState } from 'shared';
import type { DuelId, PlayerId } from 'shared';
import { computeScore } from '../scoring.js';

export const DUEL_ROUND_TIMEOUT_MS = 60_000;
export const DUEL_REVEAL_MS = 5_000;
export const DUEL_RECONNECT_GRACE_MS = 20_000;
export const DUEL_TIMEOUT_SCORE = 1e18;

export interface DuelDomainQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly unit: string;
  readonly answer: number;
}

export interface DuelDomainPlayer {
  readonly playerId: PlayerId;
readonly displayName: string;
readonly avatarUrl: string | null;
readonly bio?: string | null;
}

export interface DuelDomainSubmission {
  readonly value: number;
  readonly score: number;
  readonly timedOut: boolean;
}

export interface DuelDomainRound {
  readonly question: DuelDomainQuestion;
  readonly submissions: DuelSubmissionPair;
}

export type DuelSubmissionPair = readonly [DuelDomainSubmission | null, DuelDomainSubmission | null];

export interface DuelDomainState {
  readonly duelId: DuelId;
  readonly players: readonly [DuelDomainPlayer, DuelDomainPlayer];
  readonly rounds: readonly [DuelDomainRound, DuelDomainRound, DuelDomainRound];
  readonly phase: DuelPhase;
  readonly roundIndex: number;
  readonly roundStartedAt: string | null;
  readonly roundDeadline: string | null;
  readonly revealEndsAt: string | null;
  readonly disconnectedUntil: readonly [string | null, string | null];
  readonly winner: PlayerId | 'draw' | null;
  readonly version: number;
}

export class DuelDomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'DuelDomainError';
  }
}

export function createDuelState(input: {
  readonly duelId: DuelId;
  readonly players: readonly [DuelDomainPlayer, DuelDomainPlayer];
  readonly questions: readonly [DuelDomainQuestion, DuelDomainQuestion, DuelDomainQuestion];
  readonly now: Date;
}): DuelDomainState {
  const startedAt = input.now.toISOString();
  const deadline = new Date(input.now.getTime() + DUEL_ROUND_TIMEOUT_MS).toISOString();
  const empty: DuelSubmissionPair = [null, null];
  return {
    duelId: input.duelId,
    players: input.players,
    rounds: [
      { question: input.questions[0], submissions: empty },
      { question: input.questions[1], submissions: empty },
      { question: input.questions[2], submissions: empty },
    ],
    phase: 'question',
    roundIndex: 0,
    roundStartedAt: startedAt,
    roundDeadline: deadline,
    revealEndsAt: null,
    disconnectedUntil: [null, null],
    winner: null,
    version: 0,
  };
}

export function restoreDuelState(input: {
  readonly duelId: DuelId;
  readonly players: readonly [DuelDomainPlayer, DuelDomainPlayer];
  readonly questions: readonly [DuelDomainQuestion, DuelDomainQuestion, DuelDomainQuestion];
  readonly submissions: readonly [DuelSubmissionPair, DuelSubmissionPair, DuelSubmissionPair];
  readonly phase: DuelPhase;
  readonly roundIndex: number;
  readonly roundStartedAt: string | null;
  readonly roundDeadline: string | null;
  readonly revealEndsAt: string | null;
  readonly disconnectedUntil: readonly [string | null, string | null];
  readonly winner: PlayerId | 'draw' | null;
  readonly version: number;
  readonly now: Date;
}): DuelDomainState {
  const base = createDuelState({ duelId: input.duelId, players: input.players, questions: input.questions, now: input.now });
  const rounds: readonly [DuelDomainRound, DuelDomainRound, DuelDomainRound] = [
    { ...base.rounds[0], submissions: input.submissions[0] },
    { ...base.rounds[1], submissions: input.submissions[1] },
    { ...base.rounds[2], submissions: input.submissions[2] },
  ];
  return { ...base, rounds, phase: input.phase, roundIndex: input.roundIndex, roundStartedAt: input.roundStartedAt, roundDeadline: input.roundDeadline, revealEndsAt: input.revealEndsAt, disconnectedUntil: input.disconnectedUntil, winner: input.winner, version: input.version };
}

function playerIndex(state: DuelDomainState, playerId: PlayerId): 0 | 1 {
  if (state.players[0].playerId === playerId) return 0;
  if (state.players[1].playerId === playerId) return 1;
  throw new DuelDomainError('NOT_A_PLAYER', 'Player is not part of this duel.');
}

function requireRound(state: DuelDomainState, roundIndex: number): DuelDomainRound {
  if (roundIndex !== state.roundIndex) throw new DuelDomainError('STALE_ROUND', 'This duel round is no longer active.');
  const round = state.rounds[roundIndex];
  if (!round) throw new DuelDomainError('STALE_ROUND', 'This duel round is no longer active.');
  return round;
}

function withRound(state: DuelDomainState, roundIndex: number, round: DuelDomainRound): DuelDomainState {
  switch (roundIndex) {
    case 0: return { ...state, rounds: [round, state.rounds[1], state.rounds[2]], version: state.version + 1 };
    case 1: return { ...state, rounds: [state.rounds[0], round, state.rounds[2]], version: state.version + 1 };
    case 2: return { ...state, rounds: [state.rounds[0], state.rounds[1], round], version: state.version + 1 };
    default: throw new DuelDomainError('STALE_ROUND', 'This duel round is no longer active.');
  }
}

function revealFor(round: DuelDomainRound): DuelReveal {
  return { answer: round.question.answer, guesses: [round.submissions[0]?.timedOut ? null : round.submissions[0]?.value ?? null, round.submissions[1]?.timedOut ? null : round.submissions[1]?.value ?? null], scores: [round.submissions[0]?.score ?? null, round.submissions[1]?.score ?? null] };
}

function beginReveal(state: DuelDomainState, round: DuelDomainRound, now: Date): DuelDomainState {
  const updated = withRound(state, state.roundIndex, round);
  return { ...updated, phase: 'reveal', revealEndsAt: new Date(now.getTime() + DUEL_REVEAL_MS).toISOString() };
}

function replaceSubmission(pair: DuelSubmissionPair, index: 0 | 1, submission: DuelDomainSubmission): DuelSubmissionPair {
  return index === 0 ? [submission, pair[1]] : [pair[0], submission];
}

export function submitDuelAnswer(state: DuelDomainState, playerId: PlayerId, roundIndex: number, value: number, now: Date): DuelDomainState {
  const round = requireRound(state, roundIndex);
  if (state.phase !== 'question') throw new DuelDomainError('WRONG_PHASE', 'Answers are not being accepted.');
  if (!Number.isFinite(value) || value <= 0) throw new DuelDomainError('INVALID_VALUE', 'Answer must be a positive finite number.');
  if (state.roundDeadline && now.getTime() >= Date.parse(state.roundDeadline)) return closeExpiredRound(state, now);
  const index = playerIndex(state, playerId);
  if (round.submissions[index]) throw new DuelDomainError('DUPLICATE_SUBMISSION', 'This player already locked an answer.');
  const result = computeScore(value, round.question.answer);
  const submission: DuelDomainSubmission = { value, score: Number.isFinite(result.score) ? result.score : DUEL_TIMEOUT_SCORE, timedOut: false };
  const submissions = replaceSubmission(round.submissions, index, submission);
  const updatedRound = { ...round, submissions };
  if (submissions[0] && submissions[1]) return beginReveal(withRound(state, roundIndex, updatedRound), updatedRound, now);
  return withRound(state, roundIndex, updatedRound);
}

export function closeExpiredRound(state: DuelDomainState, now: Date): DuelDomainState {
  if (state.phase !== 'question') throw new DuelDomainError('WRONG_PHASE', 'Only an active question can expire.');
  const round = requireRound(state, state.roundIndex);
  const timeout: DuelDomainSubmission = { value: DUEL_TIMEOUT_SCORE, score: DUEL_TIMEOUT_SCORE, timedOut: true };
  const submissions: DuelSubmissionPair = [round.submissions[0] ?? timeout, round.submissions[1] ?? timeout];
  return beginReveal(state, { ...round, submissions }, now);
}

function winnerFor(state: DuelDomainState): PlayerId | 'draw' {
  const totals = [
    state.rounds.reduce((sum, round) => sum + (round.submissions[0]?.score ?? DUEL_TIMEOUT_SCORE), 0),
    state.rounds.reduce((sum, round) => sum + (round.submissions[1]?.score ?? DUEL_TIMEOUT_SCORE), 0),
  ];
  if (totals[0] === totals[1]) return 'draw';
  return totals[0] < totals[1] ? state.players[0].playerId : state.players[1].playerId;
}

export function advanceReveal(state: DuelDomainState, now: Date): DuelDomainState {
  if (state.phase !== 'reveal') throw new DuelDomainError('WRONG_PHASE', 'The duel is not in reveal.');
  if (!state.revealEndsAt || now.getTime() < Date.parse(state.revealEndsAt)) throw new DuelDomainError('REVEAL_ACTIVE', 'Reveal is still active.');
  if (state.roundIndex === 2) return { ...state, phase: 'completed', winner: winnerFor(state), revealEndsAt: null, version: state.version + 1 };
  const nextIndex = state.roundIndex + 1;
  const nextDeadline = new Date(now.getTime() + DUEL_ROUND_TIMEOUT_MS).toISOString();
  return { ...state, phase: 'question', roundIndex: nextIndex, roundStartedAt: now.toISOString(), roundDeadline: nextDeadline, revealEndsAt: null, version: state.version + 1 };
}

export function markDisconnected(state: DuelDomainState, playerId: PlayerId, now: Date): DuelDomainState {
  const index = playerIndex(state, playerId);
  const until = [...state.disconnectedUntil] as [string | null, string | null];
  until[index] = new Date(now.getTime() + DUEL_RECONNECT_GRACE_MS).toISOString();
  return { ...state, disconnectedUntil: until, version: state.version + 1 };
}

export function reconnectPlayer(state: DuelDomainState, playerId: PlayerId, now: Date): DuelDomainState {
  const index = playerIndex(state, playerId);
  const deadline = state.disconnectedUntil[index];
  if (deadline && now.getTime() >= Date.parse(deadline)) throw new DuelDomainError('RECONNECT_EXPIRED', 'Reconnect grace period has expired.');
  const disconnectedUntil = [...state.disconnectedUntil] as [string | null, string | null];
  disconnectedUntil[index] = null;
  return { ...state, disconnectedUntil, version: state.version + 1 };
}

export function forfeitDisconnectedPlayer(state: DuelDomainState, now: Date): DuelDomainState {
  const firstExpired = state.disconnectedUntil[0] !== null && now.getTime() >= Date.parse(state.disconnectedUntil[0]);
  const secondExpired = state.disconnectedUntil[1] !== null && now.getTime() >= Date.parse(state.disconnectedUntil[1]);
  if (!firstExpired && !secondExpired) throw new DuelDomainError('GRACE_ACTIVE', 'Reconnect grace period is still active.');
  const winner = firstExpired ? state.players[1].playerId : state.players[0].playerId;
  return { ...state, phase: 'forfeited', winner, version: state.version + 1 };
}

function playerView(state: DuelDomainState, index: 0 | 1, round: DuelDomainRound | undefined): DuelPlayerView {
  const submission = round?.submissions[index];
  const timedOut = state.rounds.some((item) => item.submissions[index]?.timedOut === true);
  return {
    playerId: state.players[index].playerId,
    displayName: state.players[index].displayName,
    avatarUrl: state.players[index].avatarUrl,
    bio: state.players[index].bio ?? null,
    state: submission ? submission.timedOut ? 'timed_out' : 'locked' : 'waiting',
    score: timedOut ? DUEL_TIMEOUT_SCORE : state.rounds.reduce((sum, item) => sum + (item.submissions[index]?.score ?? 0), 0),
  };
}

export function toDuelSnapshot(state: DuelDomainState): DuelSnapshot {
  const round = state.rounds[state.roundIndex];
  const players: readonly [DuelPlayerView, DuelPlayerView] = [playerView(state, 0, round), playerView(state, 1, round)];
  return {
    duelId: state.duelId,
    players,
    currentQuestion: state.phase === 'completed' || state.phase === 'forfeited' ? null : round ? { id: round.question.id, prompt: round.question.prompt, unit: round.question.unit } : null,
    phase: state.phase,
    roundIndex: state.roundIndex,
    roundDeadline: state.roundDeadline,
    reveal: state.phase === 'reveal' ? revealFor(round) : null,
    winner: state.winner,
    version: state.version,
  };
}
