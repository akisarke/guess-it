import type { DuelSnapshot } from 'shared';
import { formatExactNumber } from '../../lib/format-number';

export function DuelHeader({ snapshot, remainingMs }: { snapshot: DuelSnapshot; remainingMs: number | null }) {
  const remainingSeconds = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const timerLabel = remainingSeconds === null ? 'Reveal in progress' : `${remainingSeconds}s left`;
  const round = Math.min(snapshot.roundIndex + 1, 3);

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] opacity-70">
          Duel &middot; Round {round} of 3
        </p>
        <p
          className="text-sm font-bold tabular-nums opacity-70"
          role="status"
          aria-live="polite"
        >
          {snapshot.phase === 'question' ? timerLabel : snapshot.phase}
        </p>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={remainingSeconds ?? 0}
        aria-label={remainingSeconds === null ? 'Round timer stopped' : `Round timer: ${formatExactNumber(remainingSeconds)} seconds remaining`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: remainingMs === null ? '0%' : `${Math.min(100, Math.max(0, (remainingMs / 60000) * 100))}%` }}
        />
      </div>
    </header>
  );
}
