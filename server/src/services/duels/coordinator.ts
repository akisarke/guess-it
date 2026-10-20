import type { DuelClientCommand, DuelServerEvent } from 'shared';
import { parseDuelId, parsePlayerId } from 'shared';
import type { DuelId, PlayerId } from 'shared';
import {
  DuelDomainError,
  type DuelDomainState,
  advanceReveal,
  closeExpiredRound,
  forfeitDisconnectedPlayer,
  markDisconnected,
  reconnectPlayer,
  submitDuelAnswer,
  toDuelSnapshot,
} from './domain.js';
import { DuelRepositoryError } from './repository.js';

export type DuelEventSink = (event: DuelServerEvent) => void;

export interface DuelCoordinatorOptions {
  now?: () => Date;
  loadState?: (duelId: DuelId) => Promise<DuelDomainState | null>;
  persistState?: (state: DuelDomainState, expectedVersion: number) => Promise<void>;
}

export class DuelCoordinator {
  private states = new Map<string, DuelDomainState>();
  private listeners = new Map<string, Map<string, Set<DuelEventSink>>>();
  private now: () => Date;
  private loadState: DuelCoordinatorOptions['loadState'];
  private persistState: DuelCoordinatorOptions['persistState'];

  constructor(options: DuelCoordinatorOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.loadState = options.loadState;
    this.persistState = options.persistState;
  }

  register(state: DuelDomainState): void {
    this.states.set(state.duelId, state);
  }

  async subscribe(duelId: DuelId, playerId: PlayerId, sink: DuelEventSink): Promise<void> {
    let state = this.states.get(duelId);
    if (!state) await this.hydrate(duelId);
    state = this.states.get(duelId);
    state = state ?? this.requireState(duelId);
    this.requirePlayer(state, playerId);
    const players = this.listeners.get(duelId) ?? new Map<string, Set<DuelEventSink>>();
    const sinks = players.get(playerId) ?? new Set<DuelEventSink>();
    sinks.add(sink);
    players.set(playerId, sinks);
    this.listeners.set(duelId, players);
    await this.commit(state, reconnectPlayer(state, playerId, this.now()));
    sink(this.snapshotEvent(this.requireState(duelId)));
  }

  unsubscribe(duelId: DuelId, playerId: PlayerId, sink: DuelEventSink): void {
    const players = this.listeners.get(duelId);
    const sinks = players?.get(playerId);
    sinks?.delete(sink);
    if (sinks?.size === 0) players?.delete(playerId);
    if (players?.size === 0) this.listeners.delete(duelId);
  }

  async handle(command: DuelClientCommand, playerId: PlayerId): Promise<DuelServerEvent[]> {
    const state = this.requireState(command.duelId);
    this.requirePlayer(state, playerId);
    try {
      const next = command.type === 'duel.submit_answer'
        ? submitDuelAnswer(state, playerId, command.roundIndex, command.value, this.now())
        : command.type === 'duel.leave'
          ? markDisconnected(state, playerId, this.now())
          : state;
      await this.commit(state, next);
      const events = this.eventsFor(state, next, playerId);
      this.broadcast(command.duelId, events);
      return events;
    } catch (error) {
      if (error instanceof DuelRepositoryError) {
        const event: DuelServerEvent = { type: 'duel.error', duelId: command.duelId, version: state.version, code: error.code, message: error.message };
        this.broadcast(command.duelId, [event]);
        return [event];
      }
      if (!(error instanceof DuelDomainError)) throw error;
      const event: DuelServerEvent = { type: 'duel.error', duelId: command.duelId, version: state.version, code: error.code, message: error.message };
      this.broadcast(command.duelId, [event]);
      return [event];
    }
  }

  async tick(duelId: DuelId): Promise<DuelServerEvent[]> {
    const state = this.requireState(duelId);
    let next = state;
    try {
      if (state.phase === 'reveal') next = advanceReveal(state, this.now());
      else if (state.phase === 'question' && state.roundDeadline && this.now().getTime() >= Date.parse(state.roundDeadline)) next = closeExpiredRound(state, this.now());
      else if (state.disconnectedUntil.some((deadline) => deadline !== null && this.now().getTime() >= Date.parse(deadline))) next = forfeitDisconnectedPlayer(state, this.now());
    } catch (error) {
      if (error instanceof DuelRepositoryError) {
        const event: DuelServerEvent = { type: 'duel.error', duelId, version: state.version, code: error.code, message: error.message };
        this.broadcast(duelId, [event]);
        return [event];
      }
      if (!(error instanceof DuelDomainError)) throw error;
    }
    if (next === state) return [];
    await this.commit(state, next);
    const events = this.eventsFor(state, next, null);
    this.broadcast(duelId, events);
    return events;
  }

  activeDuelIds(): readonly DuelId[] {
    return [...this.states.keys()].map((duelId) => parseDuelId(duelId));
  }

  async hydrate(duelId: DuelId): Promise<boolean> {
    if (this.states.has(duelId)) return true;
    if (!this.loadState) return false;
    const state = await this.loadState(duelId);
    if (!state) return false;
    this.register(state);
    return true;
  }

  private requireState(duelId: DuelId): DuelDomainState {
    const state = this.states.get(duelId);
    if (!state) throw new DuelDomainError('DUEL_NOT_FOUND', 'Duel not found.');
    return state;
  }

  private requirePlayer(state: DuelDomainState, playerId: PlayerId): void {
    if (state.players[0].playerId !== playerId && state.players[1].playerId !== playerId) throw new DuelDomainError('NOT_A_PLAYER', 'Player is not part of this duel.');
  }

  private async commit(previous: DuelDomainState, next: DuelDomainState): Promise<void> {
    if (next === previous) return;
    if (this.persistState) await this.persistState(next, previous.version);
    this.states.set(next.duelId, next);
  }

  private snapshotEvent(state: DuelDomainState): DuelServerEvent {
    return { type: 'duel.snapshot', duelId: state.duelId, version: state.version, snapshot: toDuelSnapshot(state) };
  }

  private eventsFor(previous: DuelDomainState, next: DuelDomainState, playerId: PlayerId | null): DuelServerEvent[] {
    const events: DuelServerEvent[] = [this.snapshotEvent(next)];
    if (next.phase === 'question' && previous.phase === 'question' && playerId !== null) events.push({ type: 'duel.answer_locked', duelId: next.duelId, version: next.version, playerId, roundIndex: next.roundIndex });
    if (next.phase === 'reveal') events.push({ type: 'duel.round_reveal', duelId: next.duelId, version: next.version, roundIndex: next.roundIndex, reveal: toDuelSnapshot(next).reveal });
    if (next.phase === 'completed') events.push({ type: 'duel.completed', duelId: next.duelId, version: next.version, winner: next.winner });
    if (next.phase === 'forfeited') events.push({ type: 'duel.forfeited', duelId: next.duelId, version: next.version, winner: next.winner });
    return events;
  }

  private broadcast(duelId: DuelId, events: readonly DuelServerEvent[]): void {
    const players = this.listeners.get(duelId);
    if (!players) return;
    for (const sinks of players.values()) for (const sink of sinks) for (const event of events) sink(event);
  }
}

export function playerIdFromSession(value: string): PlayerId {
  return parsePlayerId(value);
}
