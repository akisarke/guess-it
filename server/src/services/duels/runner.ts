import { parseDuelId } from 'shared';
import { DuelCoordinator } from './coordinator.js';
import { DuelRepositoryError } from './repository.js';

type Timer = ReturnType<typeof setInterval> & { unref?: () => void };
type DueFilter = { readonly roundDeadlineAt: { readonly lte: Date } } | { readonly revealEndsAt: { readonly lte: Date } };

export interface DuelRunnerOptions {
  readonly intervalMs?: number;
  readonly now?: () => Date;
  readonly setInterval?: (callback: () => void, delay: number) => Timer;
  readonly clearInterval?: (timer: Timer) => void;
  readonly onError?: (error: unknown) => void;
}

export interface DuelRunnerStore {
  readonly duel: {
    readonly findMany: (args: {
      readonly where: {
        readonly status: { readonly in: ('question' | 'reveal')[] };
        readonly OR: DueFilter[];
      };
      readonly select: { readonly id: true };
    }) => Promise<readonly { readonly id: string }[]>;
  };
}

export function startDuelRunner(prisma: DuelRunnerStore, coordinator: DuelCoordinator, options: DuelRunnerOptions = {}): () => void {
  const now = options.now ?? (() => new Date());
  const setTimer = options.setInterval ?? ((callback, delay) => setInterval(callback, delay) as Timer);
  const clearTimer = options.clearInterval ?? ((timer) => clearInterval(timer));
  const run = async (): Promise<void> => {
    const currentTime = now();
    const duels = await prisma.duel.findMany({
      where: {
        status: { in: ['question', 'reveal'] },
        OR: [
          { roundDeadlineAt: { lte: currentTime } },
          { revealEndsAt: { lte: currentTime } },
        ],
      },
      select: { id: true },
    });
    for (const duel of duels) {
      const duelId = parseDuelId(duel.id);
      try {
        await coordinator.hydrate(duelId);
        await coordinator.tick(duelId);
      } catch (error: unknown) {
        if (error instanceof DuelRepositoryError && error.code === 'STALE_VERSION') continue;
        throw error;
      }
    }
  };
  const execute = () => { void run().catch((error: unknown) => options.onError?.(error)); };
  execute();
  const timer = setTimer(execute, options.intervalMs ?? 1_000);
  timer.unref?.();
  return () => clearTimer(timer);
}
