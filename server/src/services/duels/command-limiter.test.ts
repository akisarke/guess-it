import { describe, expect, it } from 'vitest';
import { parsePlayerId } from 'shared';
import { createDuelCommandLimiter } from './command-limiter.js';

describe('Duel command limiter', () => {
  it('limits one player independently and resets at the window boundary', () => {
    let nowMs = 0;
    const limiter = createDuelCommandLimiter({ capacity: 2, windowMs: 1_000 }, () => nowMs);
    const firstPlayer = parsePlayerId('player-a');
    const secondPlayer = parsePlayerId('player-b');

    expect(limiter.allow(firstPlayer)).toBe(true);
    expect(limiter.allow(firstPlayer)).toBe(true);
    expect(limiter.allow(firstPlayer)).toBe(false);
    expect(limiter.allow(secondPlayer)).toBe(true);
    nowMs = 1_000;
    expect(limiter.allow(firstPlayer)).toBe(true);
  });
});
