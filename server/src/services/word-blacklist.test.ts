import { describe, expect, test } from 'vitest';
import { containsBlockedWord } from './word-blacklist.js';

describe('containsBlockedWord', () => {
  test('blocks plain profanity', () => {
    expect(containsBlockedWord('you are shit')).toBe(true);
    expect(containsBlockedWord('FUCK off')).toBe(true);
    expect(containsBlockedWord('what a shithead')).toBe(true);
  });

  test('blocks leet-speak variants', () => {
    expect(containsBlockedWord('n1gg3r')).toBe(true);
    expect(containsBlockedWord('@sshole')).toBe(true);
  });

  test('ignores innocent lookalikes', () => {
    expect(containsBlockedWord('a classic book')).toBe(false);
    expect(containsBlockedWord('scunthorpe')).toBe(false);
    expect(containsBlockedWord('assassin')).toBe(false);
  });
});
