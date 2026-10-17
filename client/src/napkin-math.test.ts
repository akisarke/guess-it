import { describe, expect, it } from 'vitest';
import { parseNapkinMath } from './napkin-math';

describe('parseNapkinMath', () => {
  it('parses factor rows and the final equation', () => {
    expect(parseNapkinMath('Seasons: 23\nNew teammates a season: × ~10\n23 × 10 ≈ 230')).toEqual({
      rows: [
        { label: 'Seasons', value: '23' },
        { label: 'New teammates a season', value: '× ~10' },
      ],
      equation: '23 × 10 ≈ 230',
      fallback: '',
    });
  });

  it('accepts an equation without factor rows', () => {
    expect(parseNapkinMath('23 × 10 ≈ 230')).toEqual({ rows: [], equation: '23 × 10 ≈ 230', fallback: '' });
  });

  it('returns null for free text', () => {
    expect(parseNapkinMath('Count the coastlines.')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(parseNapkinMath('')).toBeNull();
  });
});
