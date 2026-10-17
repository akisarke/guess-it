import { createHash } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applySemanticLimit, buildLimiterKey, consumeLimiter, type LimiterStore } from './rate-limit.js';

const store = (result: Awaited<ReturnType<LimiterStore['consume']>>): LimiterStore => ({
  consume: async () => result,
});

describe('semantic limiter contracts', () => {
  it('normalizes account keys and hashes reset tokens without leaking credentials', () => {
    const account = buildLimiterKey('login-account', ' User@Example.COM ');
    const rawToken = randomBytes(32).toString('base64url');
    const token = buildLimiterKey('reset-token', rawToken);

    expect(account).toBe('login-account:user@example.com');
    expect(token).toBe(`reset-token:${createHash('sha256').update(rawToken).digest('hex').slice(0, 16)}`);
    expect(token).not.toContain(rawToken);
  });

  it('keeps independent semantic keys independent', () => {
    expect(buildLimiterKey('login-ip', '127.0.0.1')).not.toBe(buildLimiterKey('login-account', '127.0.0.1'));
  });

  it('returns allowed and denied results with reset metadata', async () => {
    const result = await consumeLimiter(store({ allowed: false, remaining: 0, resetAtMs: 1234 }), {
      key: 'login-ip:127.0.0.1', limit: 1, windowMs: 1000, nowMs: 234,
    });
    expect(result).toEqual({ allowed: false, remaining: 0, resetAtMs: 1234 });
  });

  it('throws a generic 429 error without leaking the key', async () => {
    const error = applySemanticLimit(store({ allowed: false, remaining: 0, resetAtMs: 1234 }), {
      key: 'login-account:user@example.com', limit: 1, windowMs: 1000, nowMs: 234,
    });
    await expect(error).rejects.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
      resetAtMs: 1234,
      resetAt: new Date(1234).toISOString(),
    });
    await expect(error).rejects.not.toThrow('user@example.com');
  });
});
