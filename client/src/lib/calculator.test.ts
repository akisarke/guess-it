import { describe, expect, it } from 'vitest';
import { evaluate } from './calculator';

describe('calculator evaluate', () => {
  it('does basic arithmetic in precedence order', () => {
    expect(evaluate('2+3')).toBe(5);
    expect(evaluate('2+3×4')).toBe(14);
    expect(evaluate('100−20÷5')).toBe(96);
  });

  it('treats % as percent, not modulo', () => {

    expect(evaluate('200×10%')).toBe(20);
    expect(evaluate('50%')).toBe(0.5);
    expect(evaluate('1+1%')).toBeCloseTo(1.01, 10);
  });

  it('evaluates powers, right-associatively', () => {
    expect(evaluate('2^10')).toBe(1024);
    expect(evaluate('2^3^2')).toBe(512);
    expect(evaluate('10^6×3')).toBe(3_000_000);
  });

  it('handles parentheses', () => {
    expect(evaluate('(2+3)×4')).toBe(20);
    expect(evaluate('2×(3+4×(1+1))')).toBe(22);
  });

  it('refuses to return a value for unusable expressions', () => {

    expect(evaluate('1÷0')).toBeNaN();
    expect(evaluate('')).toBeNaN();
    expect(evaluate('+')).toBeNaN();
    expect(evaluate('(1+2')).toBeNaN();
  });
});
