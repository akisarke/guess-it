import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { ShareCard } from '../components/ShareCard';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { formatScore } from '../lib/format-number';
import '../reveal.css';

interface TodayPuzzle {
  puzzle: { puzzleNumber: number };
  questions: { id: string; prompt: string; unit: string }[];
  userGuesses: Record<string, number>;
}

function scoreBand(score: number): string {
  if (score <= 1.5) return 'text-green-500';
  if (score <= 3.0) return 'text-amber-700';
  return 'text-red-500';
}

export function Summary() {
  const [puzzle, setPuzzle] = useState<TodayPuzzle | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTodayPuzzle().then(setPuzzle).catch((e: unknown) => setError(e instanceof Error ? e : new Error('Unable to load summary.'))).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <StateScreen
        chip="Loading"
        title="Building summary"
        description="Fetching today’s scores."
      >
        <div className="space-y-4 text-left">
          <div className="space-y-3">
            <div className="h-12 w-44 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            <div className="h-5 w-full max-w-md animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            <div className="h-5 w-5/6 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-ink/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-[var(--surface)]">
              <div className="h-3 w-16 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
              <div className="mt-3 h-6 w-28 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            </div>
            <div className="rounded-2xl border-2 border-ink/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-[var(--surface)]">
              <div className="h-3 w-20 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
              <div className="mt-3 h-6 w-24 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            </div>
          </div>
        </div>
      </StateScreen>
    );
  }

  if (error instanceof ApiError && error.status === 401) {
    return <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-12"><div className="card w-full max-w-lg overflow-hidden sm:p-8"><NotLoggedIn feature="your summary" /></div></div>;
  }

  if (error || !puzzle) {
    const isError = Boolean(error);
    return (
      <StateScreen
        chip={isError ? 'Could not load' : 'No puzzle'}
        title={isError ? 'Summary unavailable' : 'No puzzle available'}
        description={
          error?.message || 'There is no summary to show yet. Check back when the puzzle is live.'
        }
        action={
          <Link to="/" className="btn-secondary w-full sm:w-auto">
            Back to Home
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-ink/10 bg-white/75 px-4 py-3 text-left dark:border-white/10 dark:bg-[var(--surface)]">
            <p className="text-xs font-bold uppercase tracking-[0.11em] text-ink/45 dark:text-gray-400">
              Status
            </p>
            <p className="mt-1 text-base font-bold text-ink dark:text-gray-100">
              {isError ? 'Retry later' : 'Waiting on results'}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-ink/10 bg-white/75 px-4 py-3 text-left dark:border-white/10 dark:bg-[var(--surface)]">
            <p className="text-xs font-bold uppercase tracking-[0.11em] text-ink/45 dark:text-gray-400">
              Puzzle
            </p>
            <p className="mt-1 text-base font-bold text-ink dark:text-gray-100">—</p>
          </div>
        </div>
      </StateScreen>
    );
  }

  const scores = puzzle.questions.map((q) => puzzle.userGuesses[q.id] || 0);
  const answered = scores.filter((s) => s > 0);
  const hasAnswers = answered.length > 0;
  const average = hasAnswers
    ? answered.reduce((a, b) => a + b, 0) / answered.length
    : 0;
  const averageDisplay = hasAnswers ? formatScore(average) : null;

  const highestScore = Math.max(...answered, 1);

  return (
    <div className="summary-page mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
      <div className="summary-canvas">
        <header className="summary-header">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">Guess It!</Link>
          <div className="summary-rounds" aria-label={`Puzzle ${puzzle.puzzle.puzzleNumber}`}>
            {puzzle.questions.map((q, index) => {
              const answered = Boolean(puzzle.userGuesses[q.id]);
              return (
                <Link
                  key={q.id}
                  to={answered ? `/reveal/${index}` : `/play/${index}`}
                  aria-label={answered ? `View result for question ${index + 1}` : `Play question ${index + 1}`}
                  className="rounded hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/30"
                >
                  Q{index + 1}
                </Link>
              );
            })}
          </div>
          <span className="font-display text-xl font-extrabold">No. {String(puzzle.puzzle.puzzleNumber).padStart(3, '0')}</span>
        </header>

        <div className="summary-grid">
          <section className="summary-score-panel">
            <p className="summary-label">Score</p>
            <p className="summary-score" title={averageDisplay?.exact}>{averageDisplay?.visual ?? '—'}</p>
            <span className="summary-badge">{hasAnswers ? `${answered.length}/${puzzle.questions.length} ANSWERED` : 'PLAY TO SCORE'}</span>
            <p className="summary-label summary-chart-title">How everyone did</p>
            <div className="summary-chart" role="img" aria-label="Your score compared with the three daily questions">
              {scores.map((score, index) => (
                <span
                  key={puzzle.questions[index]?.id ?? index}
                  className="summary-bar"
                  style={{ height: `${score > 0 ? Math.max(18, 100 - (score / highestScore) * 70) : 12}%` }}
                />
              ))}
            </div>
            <div className="summary-chart-axis"><span>Q1</span><span>Q{puzzle.questions.length}</span></div>
            <div className="summary-actions">
              <ShareCard puzzleNumber={puzzle.puzzle.puzzleNumber} scores={scores} average={average} />
              <Link to="/" className="btn-secondary w-full text-center">Back to Home</Link>
            </div>
          </section>

          <section className="summary-question-panel">
            <p className="summary-label">Questions</p>
            <div className="summary-question-list">
              {puzzle.questions.map((q, index) => {
                const score = puzzle.userGuesses[q.id];
                const answeredQuestion = Boolean(score);
                return (
                  <Link
                    key={q.id}
                    to={answeredQuestion ? `/reveal/${index}` : `/play/${index}`}
                    aria-label={answeredQuestion ? `View result for question ${index + 1}` : `Play question ${index + 1}`}
                    className="summary-question-row"
                  >
                    <span className="summary-question-copy">
                      <span className="summary-question-number">Q{index + 1}</span>
                      <span>{q.prompt}</span>
                    </span>
                    <strong className={score ? scoreBand(score) : 'text-ink/45'}>{score ? `× ${formatScore(score).visual}` : '—'}</strong>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StateScreen({
  chip,
  title,
  description,
  children,
  action,
}: {
  chip: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="card w-full max-w-lg space-y-5 overflow-hidden text-center sm:space-y-6 sm:p-8">
        <div className="space-y-3">
          <span className="chip chip-idle mx-auto">{chip}</span>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold leading-tight text-ink dark:text-gray-100 sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-prose text-sm leading-6 text-ink/60 dark:text-gray-300 sm:text-base">
              {description}
            </p>
          </div>
        </div>

        {children}

        {action ? <div className="pt-1 sm:pt-2">{action}</div> : null}
      </div>
    </div>
  );
}
