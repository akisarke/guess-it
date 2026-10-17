import type { DuelSnapshot } from 'shared';
import { formatExactNumber } from '../../lib/format-number';

export function DuelHeader({ snapshot, remainingMs }: { readonly snapshot: DuelSnapshot; readonly remainingMs: number | null }) {
  const remainingSeconds = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const timerLabel = remainingSeconds === null ? 'Reveal in progress' : `${remainingSeconds}s left`;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="chip chip-active">Round {Math.min(snapshot.roundIndex + 1, 3)} of 3</span>
        <span className="chip chip-idle" role="status" aria-live="polite">
          {snapshot.phase === 'question' ? timerLabel : snapshot.phase}
        </span>
      </div>
      <div>
        <h1 className="font-display text-4xl font-extrabold leading-tight text-hc-ink dark:text-gray-100 sm:text-5xl">Duel the estimate</h1>
        <p className="mt-2 text-sm leading-6 text-hc-ink/65 dark:text-gray-300">Both players see the same question. The answer stays hidden until the round is complete.</p>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-hc-ink/10 dark:bg-white/10" aria-label={remainingSeconds === null ? 'Round timer stopped' : `Round timer: ${formatExactNumber(remainingSeconds)} seconds remaining`}>
        <div className="h-full rounded-pill bg-gradient-to-r from-hc-pink via-hc-peach to-hc-yellow transition-[width] duration-200" style={{ width: remainingMs === null ? '0%' : `${Math.min(100, Math.max(0, remainingMs / 60000 * 100))}%` }} />
      </div>
    </header>
  );
}
