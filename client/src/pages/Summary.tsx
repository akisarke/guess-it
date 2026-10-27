import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage, api, needsAccount } from '../lib/api';
import { SCORE_BANDS } from 'shared';
import { ShareCard } from '../components/ShareCard';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { formatScore } from '../lib/format-number';
import { animateSafe } from '../lib/anime';
import { readHardGuesses, readHardMode } from '../lib/hard-mode';
import { swipeIn } from '../lib/motion';
import { readLatestHardModeRun } from '../lib/hard-mode-history';
import '../reveal.css';

const LOG_SCORE_CAP = 10_000;

// scores are ratios, so log them like the reveal chart. one huge miss should not flatten the rest
function barHeight(score: number): number {
  if (score <= 0) return 12;
  const ratio = Math.log10(score) / Math.log10(LOG_SCORE_CAP);
  const height = Math.round(100 - ratio * 100);
  if (height >= 100) return 100;
  if (height < 18) return 18;
  return height;
}

interface SummaryView {
  label: string;
  score: string;
  exact?: string;
  badge: string;
  chartLabel: string;
  rows: { key: string; prompt: string; score: number | null; href?: string; linkLabel?: string }[];
  actions: ReactNode;
}

interface TodayPuzzle {
  puzzle: { puzzleNumber: number };
  questions: { id: string; prompt: string; unit: string }[];
  userGuesses: Record<string, number>;
}

function scoreBand(score: number): string {
  if (score <= SCORE_BANDS.close.max) return 'text-green-500';
  if (score <= SCORE_BANDS.medium.max) return 'text-amber-700';
  return 'text-red-500';
}

export function Summary() {
  const [puzzle, setPuzzle] = useState<TodayPuzzle | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  // open on the hard mode run when that's what you just played or have switched on
  const [tab, setTab] = useState<'daily' | 'hard'>(() =>
    (searchParams.get('mode') === 'hard' || readHardMode()) && readLatestHardModeRun() ? 'hard' : 'daily',
  );
  const swipedTab = useRef(tab);

  const switchTab = (next: 'daily' | 'hard') => setTab(next);

  useEffect(() => {
    if (swipedTab.current === tab) return;
    swipedTab.current = tab;
    const animation = swipeIn(gridRef.current, tab === 'hard' ? 'forward' : 'back');
    return () => animation?.cancel();
  }, [tab]);

  useEffect(() => {
    api.getTodayPuzzle().then(setPuzzle).catch((e: unknown) => setError(e instanceof Error ? e : new Error('Unable to load summary.'))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!puzzle) return;
    const animation = animateSafe(canvasRef.current, {
      translateY: [10, 0],
      duration: 420,
      ease: 'outCubic',
    });
    return () => {
      animation?.revert();
    };
  }, [puzzle]);

  if (loading) {
    return (
      <StateScreen
        chip="Loading"
        title="Building summary"
        description="Fetching today's scores."
      >
        <div className="border-t-2 border-[var(--line-strong)]" />
      </StateScreen>
    );
  }

  if (needsAccount(error)) {
    return <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-12"><NotLoggedIn feature="your summary" /></div>;
  }

  if (error || !puzzle) {
    const isError = Boolean(error);
    return (
      <StateScreen
        chip={isError ? 'Could not load' : 'No puzzle'}
        title={isError ? 'Summary unavailable' : 'No puzzle available'}
        description={
          error ? errorMessage(error, 'Your summary could not be loaded. Try again.') : 'There is no summary to show yet. Check back when the puzzle is live.'
        }
        action={
          <Link to="/" className="btn-secondary w-full sm:w-auto">
            Back to Home
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[3px] border-2 border-ink/10 bg-white/75 px-4 py-3 text-left dark:border-white/10 dark:bg-[var(--surface)]">
            <p className="text-xs font-bold tracking-[0.03em] text-ink/45 dark:text-gray-400">
              Status
            </p>
            <p className="mt-1 text-base font-bold text-ink dark:text-gray-100">
              {isError ? 'Retry later' : 'Waiting on results'}
            </p>
          </div>
          <div className="rounded-[3px] border-2 border-ink/10 bg-white/75 px-4 py-3 text-left dark:border-white/10 dark:bg-[var(--surface)]">
            <p className="text-xs font-bold tracking-[0.03em] text-ink/45 dark:text-gray-400">
              Puzzle
            </p>
            <p className="mt-1 text-base font-bold text-ink dark:text-gray-100">-</p>
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
  const hardRun = readLatestHardModeRun();
  const hardAverage = hardRun
    ? hardRun.results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, hardRun.results.length)
    : 0;
  const hardGuessIds = readHardGuesses();
  const hardDailyCount = puzzle.questions.filter((question) => hardGuessIds.has(question.id)).length;
  const dailyMode = hardDailyCount === 0
    ? 'Easy mode'
    : hardDailyCount === puzzle.questions.length
      ? 'Hard mode'
      : 'Mixed mode';

  const dailyView: SummaryView = {
    label: `${dailyMode} score`,
    score: averageDisplay?.visual ?? '-',
    exact: averageDisplay?.exact,
    badge: hasAnswers ? `${answered.length}/${puzzle.questions.length} Answered` : 'Play to score',
    chartLabel: 'Your score for each daily question',
    rows: puzzle.questions.map((q, index) => {
      const score = puzzle.userGuesses[q.id];
      return {
        key: q.id,
        prompt: q.prompt,
        score: score || null,
        href: score ? `/reveal/${index}` : `/play/${index}`,
        linkLabel: score ? `View result for question ${index + 1}` : `Play question ${index + 1}`,
      };
    }),
    actions: (
      <>
        <ShareCard puzzleNumber={puzzle.puzzle.puzzleNumber} scores={scores} average={average} />
        {answered.length === puzzle.questions.length && (
          <Link to="/hard-mode" className="btn-secondary w-full text-center">Random Hard Mode</Link>
        )}
        <Link to="/" className="btn-secondary w-full text-center" data-enter>Back to Home</Link>
      </>
    ),
  };
  const hardView: SummaryView | null = hardRun && {
    label: 'Latest hard mode practice',
    score: formatScore(hardAverage).visual,
    exact: formatScore(hardAverage).exact,
    badge: `Puzzle #${hardRun.puzzleNumber}`,
    chartLabel: 'Your score for each hard mode question',
    rows: hardRun.results.map((result, index) => ({ key: `${result.question.id}-${index}`, prompt: result.question.prompt, score: result.score })),
    actions: (
      <>
        <Link to="/hard-mode" className="btn-primary w-full text-center" data-enter>Play another hard mode puzzle</Link>
        <Link to="/" className="btn-secondary w-full text-center">Back to Home</Link>
      </>
    ),
  };
  const view = tab === 'hard' && hardView ? hardView : dailyView;

  return (
    <div className="summary-page mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
      <div ref={canvasRef} className="summary-canvas">
        <header className="summary-header">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">Guess It!</Link>
          <div className="summary-rounds" aria-label={`Puzzle ${puzzle.puzzle.puzzleNumber}`}>
            {view === dailyView && puzzle.questions.map((q, index) => {
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
          <span className="font-display text-xl font-extrabold">No. {String(view === dailyView || !hardRun ? puzzle.puzzle.puzzleNumber : hardRun.puzzleNumber).padStart(3, '0')}</span>
        </header>

        {hardRun && (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Summary mode">
            <button type="button" onClick={() => switchTab('daily')} aria-pressed={tab === 'daily'} className={`chip ${tab === 'daily' ? 'chip-active' : 'chip-idle'}`}>
              Daily
            </button>
            <button type="button" onClick={() => switchTab('hard')} aria-pressed={tab === 'hard'} className={`chip ${tab === 'hard' ? 'chip-active' : 'chip-idle'}`}>
              Hard mode
            </button>
          </div>
        )}

        <div ref={gridRef} className="summary-grid">
          <section className="summary-score-panel">
            <p className="summary-label">{view.label}</p>
            <p className="summary-score" title={view.exact}>{view.score}</p>
            <span className="summary-badge">{view.badge}</span>
            <p className="summary-label summary-chart-title">Scores by question</p>
            <div className="summary-chart" role="img" aria-label={view.chartLabel}>
              {view.rows.map((row) => (
                <span key={row.key} className="summary-bar" style={{ height: `${barHeight(row.score ?? 0)}%` }} />
              ))}
            </div>
            <div className="summary-chart-axis"><span>Q1</span><span>Q{view.rows.length}</span></div>
            <div className="summary-actions">{view.actions}</div>
          </section>

          <section className="summary-question-panel">
            <p className="summary-label">Questions</p>
            <div className="summary-question-list">
              {view.rows.map((row, index) => {
                const content = (
                  <>
                    <span className="summary-question-copy">
                      <span className="summary-question-number">Q{index + 1}</span>
                      <span>{row.prompt}</span>
                    </span>
                    <strong className={row.score ? scoreBand(row.score) : 'text-ink/45'}>{row.score ? `× ${formatScore(row.score).visual}` : '-'}</strong>
                  </>
                );
                return row.href ? (
                  <Link key={row.key} to={row.href} aria-label={row.linkLabel} className="summary-question-row">{content}</Link>
                ) : (
                  <div key={row.key} className="summary-question-row">{content}</div>
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
