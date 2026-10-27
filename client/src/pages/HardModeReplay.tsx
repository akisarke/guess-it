import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DistributionResponse, HardModePuzzleResponse } from 'shared';
import { GuessInput } from '../components/GuessInput';
import { Calculator } from '../components/Calculator';
import { RevealView } from '../components/RevealView';
import { HardModeTimer } from '../components/HardModeTimer';
import { errorMessage, api } from '../lib/api';
import { animateSafe } from '../lib/anime';
import { writeHardMode } from '../lib/hard-mode';
import {
  markHardModePuzzleSeen,
  readSeenHardModePuzzles,
  readSeenHardModeQuestions,
  saveHardModeRun,
  type HardModeResult,
} from '../lib/hard-mode-history';
import { formatScore } from '../lib/format-number';
import { play } from '../lib/sounds';
import '../reveal.css';

type PracticeResult = HardModeResult;

export function HardModeReplay() {
  const [puzzle, setPuzzle] = useState<HardModePuzzleResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [guessValue, setGuessValue] = useState(0);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [reveal, setReveal] = useState<(PracticeResult & { distribution: DistributionResponse }) | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const savedRunRef = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeHardMode(true);
  }, []);

  useEffect(() => {
    if (!puzzle) return;
    markHardModePuzzleSeen(puzzle.puzzleNumber, puzzle.questions.map((question) => question.id));
  }, [puzzle]);

  useEffect(() => {
    if (!puzzle || results.length !== puzzle.questions.length) return;
    const key = `${puzzle.puzzleNumber}:${results.map((result) => result.question.id).join(',')}`;
    if (savedRunRef.current === key) return;
    savedRunRef.current = key;
    saveHardModeRun({
      puzzleNumber: puzzle.puzzleNumber,
      puzzleDate: puzzle.puzzleDate,
      completedAt: new Date().toISOString(),
      results,
    });
  }, [puzzle, results]);

  useEffect(() => {
    const animation = animateSafe(cardRef.current, {
      translateY: [8, 0],
      duration: 340,
      ease: 'outCubic',
    });
    return () => {
      animation?.revert();
    };
  }, [puzzle?.puzzleNumber, index]);

  useEffect(() => {
    let active = true;
    setPuzzle(null);
    setLoadError(null);
    api.getHardModePuzzle([...readSeenHardModePuzzles()], [...readSeenHardModeQuestions()])
      .then((data) => {
        if (active) setPuzzle(data);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error, 'Unable to load a hard mode puzzle.'));
      });
    return () => {
      active = false;
    };
  }, [round]);

  const playAgain = () => {
    savedRunRef.current = null;
    setIndex(0);
    setGuessValue(0);
    setResults([]);
    setReveal(null);
    setSubmitError(null);
    setBusy(false);
    busyRef.current = false;
    setRound((value) => value + 1);
  };

  const finishQuestion = async (value: number) => {
    const question = puzzle?.questions[index];
    if (!question || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSubmitError(null);
    try {
      const response = await api.submitHardModeGuess({ questionId: question.id, value });
      const result = {
        question,
        guess: value,
        answer: response.answer,
        score: response.score,
      };
      setResults((previous) => [...previous, result]);
      setReveal({ ...result, distribution: response.distribution });
      setShowCalc(false);
      play('success');
    } catch (error) {
      play('error');
      setSubmitError(errorMessage(error, 'Unable to score this question. Try again.'));
      busyRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setReveal(null);
    setGuessValue(0);
    setSubmitError(null);
    setIndex((value) => value + 1);
    busyRef.current = false;
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div ref={cardRef} className="card w-full max-w-md space-y-3 text-center">
          <span className="chip chip-idle mx-auto">Could not load</span>
          <p className="font-display text-2xl font-bold text-ink dark:text-gray-100">Hard mode unavailable</p>
          <p className="text-sm text-ink/60 dark:text-gray-300">{loadError}</p>
          <Link to="/" className="btn-secondary w-full text-center">Back to home</Link>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="text-[0.68rem] font-bold tracking-[0.04em] opacity-55">Loading hard mode</p>
        <div className="mt-3 border-t-2 border-[var(--line-strong)]" />
      </div>
    );
  }

  if (index >= puzzle.questions.length) {
    const average = results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length);

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <div ref={cardRef} className="card overflow-hidden">
          <p className="summary-label">Hard mode · Puzzle #{puzzle.puzzleNumber}</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {formatScore(average).visual} average
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink/60 dark:text-gray-300">
            Random past puzzle. Practice only — it won’t change your daily score. Your last run stays on the summary.
          </p>
          <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {results.map((result, resultIndex) => (
              <div key={result.question.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0 text-sm font-bold">
                  <span className="mr-2 text-[0.66rem] opacity-60">Q{resultIndex + 1}</span>
                  {result.question.prompt}
                </span>
                <strong className="shrink-0 font-display text-lg font-extrabold">
                  {formatScore(result.score).visual}
                </strong>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={playAgain} className="btn-primary w-full">Play another random puzzle</button>
            <Link to="/summary?mode=hard" className="btn-secondary w-full text-center">Back to summary</Link>
          </div>
        </div>
      </div>
    );
  }

  const question = puzzle.questions[index];
  if (!question) return null;

  if (reveal) {
    const last = index === puzzle.questions.length - 1;
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-8 lg:py-10" key={`${puzzle.puzzleNumber}-${index}`}>
        <RevealView
          unit={reveal.question.unit}
          score={reveal.score}
          userGuess={reveal.guess}
          answer={reveal.answer}
          distribution={reveal.distribution}
          showDistribution
          practice
          chips={
            <>
              <span className="reveal-chip">Question {index + 1} of {puzzle.questions.length}</span>
              <span className="reveal-chip">Puzzle #{puzzle.puzzleNumber}</span>
              <span className="reveal-chip text-brand" style={{ borderColor: 'currentColor' }}>Hard mode</span>
            </>
          }
          actions={
            <button type="button" onClick={next} className="btn-primary w-full sm:w-auto" data-enter>
              {last ? 'See hard mode score' : 'Next question'}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div ref={cardRef} className="card overflow-hidden">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-3">
          <span className="text-xs font-bold text-ink/70 dark:text-gray-400">
            Puzzle #{puzzle.puzzleNumber} · Question {index + 1} of {puzzle.questions.length}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-brand">Hard mode</span>
            <HardModeTimer key={`${question.id}-${index}`} onExpire={() => void finishQuestion(Math.max(1, guessValue))} />
            <span className="text-xs font-bold text-ink/60 dark:text-gray-400">No Googling</span>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-ink dark:text-gray-100 sm:text-4xl">
              {question.prompt}
            </h2>
            <p className="max-w-prose text-sm leading-6 text-ink/70 dark:text-gray-300 sm:text-base">
              Enter your best estimate, then lock it in.
            </p>
            <p className="text-xs font-bold tracking-[0.03em] text-brand">
              10 seconds. When the clock runs out, your number locks in (blank counts as 1).
            </p>
          </div>

          <div className="space-y-4">
            {submitError && <p role="alert" className="text-sm font-bold text-brand">{submitError}</p>}
            <GuessInput
              unit={question.unit}
              value={guessValue}
              onChange={setGuessValue}
              onSubmit={(value) => void finishQuestion(value)}
              disabled={busy}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowCalc(true)}
                className="btn-secondary flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Calculator
              </button>
              <button
                type="button"
                onClick={() => void finishQuestion(guessValue)}
                disabled={busy || guessValue <= 0}
                className="btn-primary w-full sm:flex-1"
                data-enter
              >
                {busy ? 'Locking in...' : 'Lock it in'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCalc && (
        <Calculator
          onUseResult={(value) => {
            setGuessValue(Math.round(value));
            setShowCalc(false);
          }}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  );
}
