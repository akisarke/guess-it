import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { LimiterPolicyName } from '../config.js';
import { RateLimitError } from '../errors/application-error.js';

export type LimiterKey = `${string}:${string}`;
export type LimiterInput = Readonly<{ key: LimiterKey; limit: number; windowMs: number; nowMs: number }>;
export type LimiterResult = Readonly<{ allowed: boolean; remaining: number; resetAtMs: number }>;

export interface LimiterStore {
  consume(input: LimiterInput): Promise<LimiterResult>;
}

export function createDeterministicLimiterStore(): LimiterStore {
  const entries = new Map<string, Readonly<{ count: number; resetAtMs: number }>>();
  return {
    async consume(input) {
      const current = entries.get(input.key);
      const resetAtMs = current && current.resetAtMs > input.nowMs ? current.resetAtMs : input.nowMs + input.windowMs;
      const count = current && current.resetAtMs > input.nowMs ? current.count + 1 : 1;
      const result = { allowed: count <= input.limit, remaining: Math.max(0, input.limit - count), resetAtMs };
      entries.set(input.key, { count, resetAtMs });
      return result;
    },
  };
}

export function buildLimiterKey(kind: string, value: string): LimiterKey {
  const normalized = kind === 'reset-token'
    ? createHash('sha256').update(value).digest('hex').slice(0, 16)
    : value.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${kind}:${normalized}`;
}

export async function consumeLimiter(store: LimiterStore, input: LimiterInput): Promise<LimiterResult> {
  return store.consume(input);
}

export async function applySemanticLimit(store: LimiterStore, input: LimiterInput): Promise<void> {
  const result = await consumeLimiter(store, input);
  if (result.allowed) return;
  throw new RateLimitError('Too many requests.', {
    resetAtMs: result.resetAtMs,
    resetAt: new Date(result.resetAtMs).toISOString(),
  });
}

export function semanticLimit(policyName: LimiterPolicyName, key: (request: FastifyRequest) => LimiterKey | undefined) {
  return async (request: FastifyRequest): Promise<void> => {
    const limiterKey = key(request);
    if (!limiterKey) return undefined;
    return applySemanticLimit(request.server.limiterStore, {
      key: limiterKey,
      ...request.server.config.rateLimits[policyName],
      nowMs: Date.now(),
    });
  };
}
