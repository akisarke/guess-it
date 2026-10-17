import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatExactNumber, formatScore } from './format-number';

describe('number formatting', () => {
  it('formats values with compact units', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(999.5)).toBe('999.5');
    expect(formatCompactNumber(1_234)).toBe('1.23K');
    expect(formatCompactNumber(1_000_000)).toBe('1M');
    expect(formatCompactNumber(1_250_000_000)).toBe('1.25B');
    expect(formatCompactNumber(7_800_000_000_000)).toBe('7.8T');
  });

  it('keeps an exact grouped label for compact values', () => {
    expect(formatExactNumber(1_230_000_000)).toBe('1,230,000,000');
  });

  it('formats ordinary scores and timeout scores', () => {
    expect(formatScore(1.2345)).toEqual({ visual: '1.23×', exact: '1.2345×', isTimeout: false });
    expect(formatScore(1e18)).toEqual({ visual: 'Timed out', exact: 'Timed out', isTimeout: true });
  });

  it('rejects non-finite and negative values', () => {
    expect(() => formatCompactNumber(-1)).toThrow(RangeError);
    expect(() => formatCompactNumber(Number.NaN)).toThrow(RangeError);
    expect(() => formatCompactNumber(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
