import type { PlayerId } from 'shared';

export type DuelCommandLimit = { capacity: number; windowMs: number };
export type DuelClock = () => number;

export interface DuelCommandLimiter {
  allow(playerId: PlayerId): boolean;
}

export function createDuelCommandLimiter(limit: DuelCommandLimit, now: DuelClock = Date.now): DuelCommandLimiter {
  const entries = new Map<PlayerId, { count: number; resetAtMs: number }>();
  return {
    allow(playerId) {
      const nowMs = now();
      const current = entries.get(playerId);
      const active = current !== undefined && current.resetAtMs > nowMs;
      const count = active ? current.count + 1 : 1;
      const resetAtMs = active ? current.resetAtMs : nowMs + limit.windowMs;
      entries.set(playerId, { count, resetAtMs });
      return count <= limit.capacity;
    },
  };
}
