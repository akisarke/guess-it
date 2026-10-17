import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { useLandingState } from '../hooks/use-landing-state';

export function Landing() {
  const navigate = useNavigate();
  const { puzzle, loading, error, authState, ctaLabel, progress, handlePlay, retryAuth } = useLandingState();
  const { answeredCount, firstUnansweredIndex, isComplete } = progress;

  if (authState === 'unavailable') return <LandingShell><AuthUnavailable onRetry={retryAuth} /></LandingShell>;

  if (loading)
    return (
      <LandingShell>
        <div className="space-y-8 text-center">
          <div className="mx-auto h-6 w-28 animate-pulse rounded-pill bg-hc-ink/10 dark:bg-white/10" />
          <div className="space-y-4">
            <div className="mx-auto h-14 w-48 animate-pulse rounded-2xl bg-hc-ink/10 dark:bg-white/10 sm:h-16 sm:w-64" />
            <div className="mx-auto h-4 w-full max-w-xl animate-pulse rounded-full bg-hc-ink/10 dark:bg-white/10" />
            <div className="mx-auto h-4 w-11/12 max-w-lg animate-pulse rounded-full bg-hc-ink/10 dark:bg-white/10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="space-y-3 rounded-3xl border-2 border-hc-ink/10 bg-white/70 p-5 text-left dark:border-white/10 dark:bg-white/5 sm:p-6">
              <div className="h-3 w-24 animate-pulse rounded-full bg-hc-ink/10 dark:bg-white/10" />
              <div className="h-11 w-20 animate-pulse rounded-2xl bg-hc-ink/10 dark:bg-white/10" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-hc-ink/10 dark:bg-white/10" />
              <div className="flex flex-wrap gap-2 pt-2">
                <div className="h-8 w-20 animate-pulse rounded-pill bg-hc-ink/10 dark:bg-white/10" />
                <div className="h-8 w-20 animate-pulse rounded-pill bg-hc-ink/10 dark:bg-white/10" />
                <div className="h-8 w-20 animate-pulse rounded-pill bg-hc-ink/10 dark:bg-white/10" />
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border-2 border-hc-ink/10 bg-white/70 p-5 text-left dark:border-white/10 dark:bg-white/5 sm:p-6">
              <div className="h-3 w-32 animate-pulse rounded-full bg-hc-ink/10 dark:bg-white/10" />
              <div className="flex items-end justify-between gap-4">
                <div className="h-14 w-20 animate-pulse rounded-2xl bg-hc-ink/10 dark:bg-white/10" />
                <div className="h-8 w-24 animate-pulse rounded-pill bg-hc-ink/10 dark:bg-white/10" />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 animate-pulse rounded-full border-2 border-hc-ink/10 bg-hc-ink/10 dark:border-white/10 dark:bg-white/10"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto h-12 w-full max-w-sm animate-pulse rounded-pill bg-hc-ink/10 dark:bg-white/10" />
        </div>
      </LandingShell>
    );

  if (!puzzle)
    return (
      <LandingShell>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center">
          <section className="space-y-5 text-center lg:text-left">
            <span className="chip chip-idle mx-auto lg:mx-0">
              <span className="h-2 w-2 rounded-full bg-hc-violet" />
              Ready when you are
            </span>
            <div className="space-y-3">
              <h1 className="font-display text-5xl font-extrabold leading-[0.92] tracking-tight sm:text-6xl">
                  <span className="bg-gradient-to-r from-hc-pink via-hc-peach to-hc-violet bg-clip-text text-transparent">
                  Guess It!
                </span>
              </h1>
              <p className="max-w-xl text-base leading-7 text-hc-ink/60 dark:text-gray-300 sm:text-lg">
                Make a guess, see how close you got, and build a better instinct one puzzle at a time.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              <span className="chip chip-idle">Estimate</span>
              <span className="chip chip-idle">Lock it in</span>
              <span className="chip chip-idle">Compare</span>
            </div>
          </section>

          <aside className="space-y-3 rounded-3xl border-2 border-hc-ink/10 bg-white/70 p-4 text-left dark:border-white/10 dark:bg-white/5 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hc-ink/45 dark:text-gray-400">Daily puzzle</p>
                <p className="mt-2 text-lg font-bold text-hc-ink dark:text-gray-100">Your next estimate is ready.</p>
                <p className="mt-1 text-sm font-semibold text-hc-ink/60 dark:text-gray-300">0 of 3 solved</p>
              </div>
              <span className="chip chip-idle shrink-0">3 rounds</span>
            </div>
            <div className="flex justify-center gap-2 rounded-2xl border-2 border-dashed border-hc-ink/10 bg-white/65 p-4 dark:border-white/10 dark:bg-white/5">
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} className="h-4 w-4 rounded-full border-2 border-hc-ink/25 dark:border-white/30" />
              ))}
            </div>
          </aside>
        </div>
        {error && <p className="mt-5 rounded-2xl border-2 border-hc-pink/30 bg-hc-pink/10 px-4 py-3 text-sm font-semibold text-hc-ink dark:text-pink-100" role="alert">{error}</p>}
        <div className="mt-7 flex flex-col items-center gap-3 text-center sm:mt-8">
          <button type="button" onClick={() => void handlePlay()} className="btn-primary w-full sm:w-auto sm:min-w-[16rem]" disabled={loading || authState === 'checking'}>
            {loading ? 'Loading puzzle…' : 'Play today’s puzzle'}
          </button>
        </div>
      </LandingShell>
    );

  return (
    <LandingShell>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center">
        <section className="space-y-5 text-center lg:text-left">
          <span className="chip chip-idle mx-auto lg:mx-0">
            <span className="w-2 h-2 rounded-full bg-hc-mint" />
            Puzzle #{puzzle.puzzle.puzzleNumber}
          </span>

          <div className="space-y-4">
            <h1 className="font-display text-5xl font-extrabold tracking-tight leading-[0.92] sm:text-6xl">
              <span className="bg-gradient-to-r from-hc-pink via-hc-peach to-hc-violet bg-clip-text text-transparent">
                Guess It!
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-7 text-hc-ink/60 dark:text-gray-300 sm:text-lg lg:mx-0">
              How close can you get? Estimate, lock it in, compare.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            <span className="chip chip-idle">Estimate</span>
            <span className="chip chip-idle">Lock it in</span>
            <span className="chip chip-idle">Compare</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
             <span className="chip chip-idle">{puzzle.questions.length} rounds</span>
            <span className="chip chip-idle">Ready in one tap</span>
          </div>
        </section>

        <aside className="space-y-3 rounded-3xl border-2 border-hc-ink/10 bg-white/70 p-4 text-left dark:border-white/10 dark:bg-white/5 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hc-ink/45 dark:text-gray-400">
                Puzzle progress
              </p>
              <p className="mt-2 text-lg font-bold text-hc-ink dark:text-gray-100">
                {answeredCount} of {puzzle.questions.length} solved
              </p>
            </div>
            <span className="chip chip-idle shrink-0">{puzzle.questions.length} total</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2 rounded-2xl border-2 border-dashed border-hc-ink/10 bg-white/65 p-4 dark:border-white/10 dark:bg-white/5">
            {puzzle.questions.map((q) => (
              <span
                key={q.id}
                className={`h-4 w-4 rounded-full border-2 transition-colors sm:h-5 sm:w-5 ${
                  puzzle.userGuesses[q.id]
                    ? 'border-hc-mint bg-hc-mint'
                    : 'border-hc-ink/20 bg-transparent dark:border-white/25'
                }`}
                aria-hidden="true"
                title={puzzle.userGuesses[q.id] ? 'Completed' : 'Not answered yet'}
              />
            ))}
          </div>

        </aside>
      </div>

      <div className="mt-7 flex flex-col items-center gap-3 text-center sm:mt-8">
        <button type="button" onClick={() => void handlePlay()} className="btn-primary w-full sm:w-auto sm:min-w-[16rem]" disabled={loading || authState === 'checking'}>
          {ctaLabel}
        </button>
      </div>
    </LandingShell>
  );
}

function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:py-10 lg:py-12">
      <div className="card overflow-hidden">{children}</div>
    </div>
  );
}
