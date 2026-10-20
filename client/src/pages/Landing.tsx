import type { ReactNode } from 'react';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { formatCompactNumber, formatScore } from '../lib/format-number';
import { useLandingState } from '../hooks/use-landing-state';

export function Landing() {
  const { puzzle, loading, error, authState, ctaLabel, progress, handlePlay, retryAuth } = useLandingState();
  const { answeredCount, isComplete } = progress;
  const total = puzzle?.questions.length ?? 3;

  if (authState === 'unavailable') return <LandingShell><AuthUnavailable onRetry={retryAuth} /></LandingShell>;

  if (loading)
    return (
      <LandingShell>
        <div className="space-y-8 text-accent-ink">
          <div className="flex items-center justify-between">
            <div className="h-5 w-28 animate-pulse rounded-md bg-accent-ink/15" />
            <div className="h-5 w-20 animate-pulse rounded-md bg-accent-ink/15" />
          </div>
          <div className="space-y-4">
            <div className="h-14 w-4/5 animate-pulse rounded-lg bg-accent-ink/15 sm:h-20" />
            <div className="h-6 w-2/3 animate-pulse rounded-md bg-accent-ink/10" />
          </div>
          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse rounded-md bg-accent-ink/10" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-2.5 w-10 animate-pulse rounded bg-accent-ink/15" />
                  <div className="h-2.5 w-14 animate-pulse rounded bg-accent-ink/10" />
                  <div className="h-7 w-16 animate-pulse rounded bg-accent-ink/15" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-12 w-full max-w-xs animate-pulse rounded-lg bg-accent-ink/15" />
        </div>
      </LandingShell>
    );

  return (
    <LandingShell>
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-lg font-extrabold tracking-tight">Guess It!</span>
        {puzzle && (
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] opacity-75">
            {`No. ${String(puzzle.puzzle.puzzleNumber).padStart(3, '0')}`}
          </span>
        )}
      </div>

      <div className="mt-8 sm:mt-12">
        <h1 className="font-display text-[2rem] font-extrabold leading-[0.95] sm:text-6xl">
          Make an educated guess.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 sm:text-lg">
          Three questions a day. Guess a number, see how far off you were.
        </p>
      </div>

      <div className="mt-8 border-t border-accent-ink/15 pt-6 sm:mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-bold">{answeredCount} of {total} solved</p>
          {isComplete && <p className="text-sm font-bold opacity-75">All done</p>}
        </div>

        {

}
        <ul className="mt-6 grid grid-cols-3 divide-x divide-accent-ink/15">
          {Array.from({ length: total }).map((_, index) => {
            const question = puzzle?.questions[index];
            const score = (question && puzzle?.userGuesses[question.id]) || 0;
            const solved = score > 0;

            return (
              <li
                key={question?.id ?? index}
                aria-label={
                  solved
                    ? `Puzzle ${index + 1}: off by ${formatCompactNumber(score)} times`
                    : `Puzzle ${index + 1}: not answered yet`
                }
                className="px-3 first:pl-0 sm:px-6 sm:first:pl-0 last:pr-0"
              >
                <span
                  aria-hidden="true"
                  className="block whitespace-nowrap text-[0.65rem] font-bold uppercase tracking-[0.08em] opacity-75 sm:text-[0.7rem] sm:tracking-[0.08em]"
                >
                  {`${String(index + 1).padStart(2, '0')} · Off by`}
                </span>

                <span
                  aria-hidden="true"

                  className="mt-2 block font-display text-2xl font-extrabold leading-none tabular-nums sm:text-3xl"
                >
                  {solved ? formatScore(score).visual : '-'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-accent-ink/30 bg-accent-ink/10 px-4 py-3 text-sm font-bold" role="alert">
          {error}
        </p>
      )}

      <div className="mt-12">
        <button
          type="button"
          onClick={() => void handlePlay()}
          className="btn-invert w-full sm:w-auto sm:min-w-[16rem]"
          disabled={loading || authState === 'checking'}
        >
          {ctaLabel}
        </button>
      </div>
    </LandingShell>
  );
}

function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell py-8 lg:py-12">
      <article className="overflow-hidden rounded-3xl border border-transparent bg-accent text-accent-ink">
        <div className="px-6 py-8 sm:px-8 sm:py-12 lg:px-12">{children}</div>
      </article>
    </div>
  );
}
