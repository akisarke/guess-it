import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSoloGame } from '../hooks/use-solo-game';
import { GeneratedSetContext } from '../components/GeneratedSetContext';
import { SoloLoadError } from '../components/SoloLoadError';
import { DistributionGraph } from '../components/DistributionGraph';
import '../reveal.css';
import {
  DistributionResponse,
  QuestionPublic,
  SCORE_BANDS,
  ScoreBand,
  ScoreDirection,
  getScoreBand,
} from 'shared';
import { play } from '../lib/sounds';
import { formatCompactNumber, formatExactNumber, formatScore } from '../lib/format-number';
import { parseNapkinMath } from '../napkin-math';

function formatValue(value: number): string {
  return formatCompactNumber(value);
}

function computeDirection(userGuess: number | null, answer: number | null): ScoreDirection {
  if (userGuess == null || answer == null) return 'Exact';
  if (userGuess < answer) return 'Too Low';
  if (userGuess > answer) return 'Too High';
  return 'Exact';
}

function computeRank(data: DistributionResponse | null, userGuess: number | null): { rank: number; total: number } | null {
  if (!data || data.bins.length === 0 || userGuess == null || userGuess <= 0) return null;
  const total = data.bins.reduce((sum, b) => sum + b.count, 0);
  if (total <= 0) return null;
  const logAnswer = Math.log10(data.answer > 0 ? data.answer : 1);
  const userDistance = Math.abs(Math.log10(userGuess) - logAnswer);
  let closer = 0;
  for (const bin of data.bins) {
    const mid = (bin.low + bin.high) / 2;
    if (mid <= 0 || bin.count <= 0) continue;
    if (Math.abs(Math.log10(mid) - logAnswer) < userDistance - 1e-9) closer += bin.count;
  }
  return { rank: Math.min(closer + 1, total), total };
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function Reveal() {
  const navigate = useNavigate();
  const { puzzle, loading, error, idx, setId, prefix, query: puzzleQuery } = useSoloGame();
  const [dist, setDist] = useState<{ readonly questionId: string; readonly data: DistributionResponse } | null>(null);

  const question: QuestionPublic | null =
    puzzle && puzzle.questions && puzzle.questions[idx] ? puzzle.questions[idx] : null;
  const score = question && puzzle ? puzzle.userGuesses[question.id] ?? 0 : 0;
  const hasAnswered = question != null && score > 0;

  const distData = dist !== null && dist.questionId === question?.id ? dist.data : null;

  useEffect(() => {
    if (!question || !hasAnswered) return;
    let active = true;
    api
      .getDistribution(question.id)
      .then((data) => { if (active) setDist({ questionId: question.id, data }); })
      .catch(() => { if (active) setDist(null); });
    return () => { active = false; };
  }, [question?.id, hasAnswered]);

  useEffect(() => {
    if (loading) return;
    if (setId !== undefined && error) return;
    if (!puzzle || !question || !hasAnswered) {
       navigate(`${prefix}/play/${idx}${puzzleQuery}`);
    }
  }, [loading, puzzle, question, hasAnswered, idx, navigate, puzzleQuery, prefix, setId, error]);

  useEffect(() => {
    if (!loading && hasAnswered) {
      play('success');
    }
  }, [loading, hasAnswered]);

  if (setId !== undefined && error) return <SoloLoadError error={error} />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md space-y-4 text-center">
          <span className="chip chip-idle mx-auto">Loading</span>
          <div className="space-y-3">
            <div className="mx-auto h-8 w-44 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            <div className="mx-auto h-4 w-56 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!puzzle || !question || !hasAnswered) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md space-y-3 text-center">
          <span className="chip chip-idle mx-auto">Redirecting</span>
          <p className="font-display text-2xl font-bold text-ink dark:text-gray-100">Loading reveal</p>
          <p className="text-sm text-ink/60 dark:text-gray-300">Taking you back to the active question.</p>
        </div>
      </div>
    );
  }

  const userGuess = distData ? distData.userGuess : null;
  const answer = distData ? distData.answer : null;
  const direction = computeDirection(userGuess, answer);
  const band: ScoreBand = getScoreBand(score);
  const bandColor = SCORE_BANDS[band].color;
  const rank = computeRank(distData, userGuess);
  const rankLine =
    rank == null
      ? 'Rank is still being counted.'
      : rank.total <= 1
        ? "You're the first to lock in — check back as more players guess."
        : `You were the ${ordinal(rank.rank)} closest of ${rank.total} players.`;
  const nextHref = idx < puzzle.questions.length - 1 ? `${prefix}/reveal/${idx + 1}${puzzleQuery}` : `${prefix}/summary`;
  const nextLabel = idx < puzzle.questions.length - 1 ? 'Next Question' : 'See Summary';
  const sourceLabel = 'set' in puzzle ? puzzle.set.title : `Puzzle #${puzzle.puzzle.puzzleNumber}`;
  const guessLabel = userGuess != null ? `${formatValue(userGuess)} ${question.unit}` : '—';
  const answerLabel = answer != null ? `${formatValue(answer)} ${question.unit}` : '—';
  const napkinMath = distData?.napkinMath?.trim() ? distData.napkinMath : '';
  const parsedNapkinMath = napkinMath ? parseNapkinMath(napkinMath) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-8 lg:py-10">
      <div className={`reveal-canvas${answer != null ? ' reveal-canvas--landed' : ''}`} key={idx}>
        {'set' in puzzle && <GeneratedSetContext set={puzzle.set} />}
        <div className="reveal-topbar">
          <span className="reveal-chip">Question {idx + 1} of {puzzle.questions.length}</span>
          <span className="reveal-chip">{sourceLabel}</span>
          <span
            className="reveal-chip reveal-chip--muted"
            style={{ borderColor: bandColor, color: bandColor }}
          >
            {SCORE_BANDS[band].label} band
          </span>
        </div>

        <div className="mt-5 space-y-4 lg:space-y-5">
          <section className="reveal-grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
            <article className="reveal-panel reveal-panel--guess">
              <p className="reveal-kicker">Your guess</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                 <div className="reveal-value reveal-value--yellow" title={userGuess != null ? formatExactNumber(userGuess) : undefined}>{userGuess != null ? formatValue(userGuess) : '—'}</div>
                <div className="reveal-unit">{question.unit}</div>
              </div>
              <p className="reveal-copy mt-3">You locked in {guessLabel}. The app scored the guess after the answer was revealed.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Direction</p>
                  <p className="reveal-metric-value">{direction}</p>
                </div>
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Score band</p>
                  <p className="reveal-metric-value">{SCORE_BANDS[band].label}</p>
                </div>
              </div>
            </article>

            <article className="reveal-panel reveal-panel--answer">
              <p className="reveal-kicker">Correct answer</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                 <div className="reveal-value reveal-value--answer" title={answer != null ? formatExactNumber(answer) : undefined}>{answer != null ? formatValue(answer) : '—'}</div>
                <div className="reveal-unit text-ink/70 dark:text-white/70">{question.unit}</div>
              </div>
              <p className="reveal-copy mt-3">The estimated answer is {answerLabel}.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Unit</p>
                  <p className="reveal-metric-value">{question.unit}</p>
                </div>
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Source</p>
                  <p className="reveal-metric-value">{sourceLabel}</p>
                </div>
              </div>
            </article>
          </section>

          <section className="relative grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
            <div className="reveal-divider absolute inset-y-4 left-1/2 w-px -translate-x-1/2" aria-hidden="true" />
            <article className="reveal-landed">
              <p className="reveal-kicker">Landed</p>
              <div className="reveal-landed-score">
                 <div className="reveal-score" title={formatScore(score).exact}>{formatScore(score).visual}</div>
                <div className="min-w-[13rem] flex-1 pb-1">
                  <p className="reveal-kicker">Score</p>
                  <p className="mt-1 text-lg font-bold leading-tight text-ink dark:text-gray-100 sm:text-xl">
                    {rankLine}
                  </p>
                </div>
              </div>
              <div className="reveal-note">
                <span>Direction: {direction}</span>
                <span>Band: {SCORE_BANDS[band].label}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Your guess</p>
                   <p className="reveal-metric-value" title={userGuess != null ? formatExactNumber(userGuess) : undefined}>{guessLabel}</p>
                </div>
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Answer</p>
                   <p className="reveal-metric-value" title={answer != null ? formatExactNumber(answer) : undefined}>{answerLabel}</p>
                </div>
              </div>
            </article>

            <article className="reveal-landed">
              <DistributionGraph data={distData} userGuess={userGuess} userScoreBand={band} />
            </article>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <details className="reveal-napkin">
              <summary>
                <span>Napkin Math</span>
                <svg className="napkin-chevron h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              {parsedNapkinMath ? (
                <div className="reveal-napkin-rows" aria-label="Napkin math breakdown">
                  {parsedNapkinMath.rows.map((row) => (
                    <div className="reveal-napkin-row" key={`${row.label}-${row.value}`}>
                      <span>{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                  ))}
                  {parsedNapkinMath.equation && (
                    <div className="reveal-napkin-equation">
                      <span>{parsedNapkinMath.equation.split('≈')[0].trim()}</span>
                      <span>≈ {parsedNapkinMath.equation.split('≈').slice(1).join('≈').trim()}</span>
                    </div>
                  )}
                  {parsedNapkinMath.fallback && <p className="reveal-napkin-text">{parsedNapkinMath.fallback}</p>}
                </div>
              ) : napkinMath ? (
                <p className="reveal-napkin-text">{napkinMath}</p>
              ) : (
                <p className="reveal-napkin-text">No napkin math was saved for this question.</p>
              )}
              <div className="reveal-napkin-body">
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Score</p>
                   <p className="reveal-metric-value" title={formatScore(score).exact}>{formatScore(score).visual}</p>
                </div>
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Rank</p>
                  <p className="reveal-metric-value">{rank ? `${ordinal(rank.rank)} of ${rank.total}` : '—'}</p>
                </div>
                <div className="reveal-metric">
                  <p className="reveal-metric-label">Direction</p>
                  <p className="reveal-metric-value">{direction}</p>
                </div>
              </div>
            </details>

            <div className="reveal-actions lg:justify-start">
              {idx > 0 && (
                <Link to={`${prefix}/reveal/${idx - 1}${puzzleQuery}`} className="btn-secondary w-full text-center sm:w-auto">
                  Previous
                </Link>
              )}
              <Link to={nextHref} className="btn-primary w-full text-center sm:w-auto">{nextLabel}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
