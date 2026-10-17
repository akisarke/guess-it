import { describe, expect, it } from 'vitest';
import type { DuelClientCommand, DuelServerEvent } from './duels.js';
import { parseDuelId, parsePlayerId, parseQuestionId, parseGeneratedQuestionSetId, type GameSourceResponse, type GeneratedQuestionSet } from './generated-sets.js';

const duelId = parseDuelId('d1');
const playerOneId = parsePlayerId('p1');
const playerTwoId = parsePlayerId('p2');

function eventName(event: DuelServerEvent): string {
  switch (event.type) {
    case 'duel.snapshot': return event.type;
    case 'duel.player_status': return event.type;
    case 'duel.answer_locked': return event.type;
    case 'duel.round_reveal': return event.type;
    case 'duel.round_started': return event.type;
    case 'duel.completed': return event.type;
    case 'duel.forfeited': return event.type;
    case 'duel.error': return event.type;
    default: return event satisfies never;
  }
}

describe('DuelServerEvent', () => {
  it('preserves every event discriminator', () => {
    const events: readonly DuelServerEvent[] = [
      { type: 'duel.snapshot', duelId, version: 1, snapshot: null },
      { type: 'duel.player_status', duelId, version: 2, playerId: playerOneId, state: 'locked' },
      { type: 'duel.answer_locked', duelId, version: 3, playerId: playerOneId, roundIndex: 0 },
      { type: 'duel.round_reveal', duelId, version: 4, roundIndex: 0, reveal: null },
      { type: 'duel.round_started', duelId, version: 5, roundIndex: 1, roundDeadline: '2026-09-12T00:01:00Z', question: null },
      { type: 'duel.completed', duelId, version: 6, winner: null },
      { type: 'duel.forfeited', duelId, version: 7, winner: playerTwoId },
      { type: 'duel.error', duelId, version: 8, code: 'invalid_command', message: 'Invalid command' },
    ];

    expect(events.map(eventName)).toEqual([
      'duel.snapshot',
      'duel.player_status',
      'duel.answer_locked',
      'duel.round_reveal',
      'duel.round_started',
      'duel.completed',
      'duel.forfeited',
      'duel.error',
    ]);
  });
});

describe('DuelClientCommand', () => {
  it('constructs every command discriminator', () => {
    const commands: readonly DuelClientCommand[] = [
      { type: 'duel.subscribe', duelId },
      { type: 'duel.submit_answer', duelId, roundIndex: 0, value: 42 },
      { type: 'duel.leave', duelId },
    ];

    expect(commands.map((command) => command.type)).toEqual([
      'duel.subscribe',
      'duel.submit_answer',
      'duel.leave',
    ]);
  });
});

describe('generated set API contracts', () => {
  it('requires exactly three public questions', () => {
    const question = { id: parseQuestionId('q1'), prompt: 'How many?', unit: 'items' };
    const set: GeneratedQuestionSet = {
      id: parseGeneratedQuestionSetId('set1'),
      title: 'Three questions',
      topic: 'Science',
      difficulty: 'medium',
      createdAt: '2026-09-12T00:00:00Z',
      completed: false,
      questions: [question, { ...question, id: parseQuestionId('q2') }, { ...question, id: parseQuestionId('q3') }],
    };
    const response: GameSourceResponse = {
      source: { kind: 'generated', id: set.id },
      questions: set.questions,
      set,
      userGuesses: {},
    };

    expect(response.questions).toHaveLength(3);
  });
});
