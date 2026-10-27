import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { Faqs } from '../components/landing/Faqs';
import { HowToPlay } from '../components/landing/HowToPlay';
import { HardModeToggle } from '../components/HardModeToggle';
import { formatCompactNumber, formatScore } from '../lib/format-number';
import { animateSafe, stagger } from '../lib/anime';
import { readHardGuesses, readHardMode, writeHardMode } from '../lib/hard-mode';
import { readLatestHardModeRun } from '../lib/hard-mode-history';
import { useLandingState } from '../hooks/use-landing-state';
import '../reveal.css';

export function Landing() {
  const navigate = useNavigate();
  const { puzzle, loading, error, authState, ctaLabel, progress, handlePlay, retryAuth } = useLandingState();
  const { answeredCount, isComplete } = progress;
  const total = puzzle?.questions.length ?? 3;
  const [hardMode, setHardMode] = useState(readHardMode);
  const [hardGuesses, setHardGuesses] = useState(readHardGuesses);
  const [hardRun, setHardRun] = useState(readLatestHardModeRun);
  const scoreListRef = useRef<HTMLUListElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  const toggleHardMode = () => {
    const next = !hardMode;
    writeHardMode(next);
    setHardMode(next);
    setHardGuesses(readHardGuesses());
    setHardRun(readLatestHardModeRun());
  };

  const hardModeComplete = hardMode && isComplete;
  // in hard mode the board shows hard scores: today's questions you played in
  // hard mode, and your latest hard mode run for the rest
  const dailyAllHard = Boolean(puzzle?.questions.length) && puzzle!.questions.every((question) => hardGuesses.has(question.id));
  const showHardRun = hardMode && !dailyAllHard;
  // once you've finished a hard mode run today, the button leads to its summary,
  // the same way easy mode does after the daily
  const hardDoneToday = hardRun !== null && new Date(hardRun.completedAt).toDateString() === new Date().toDateString();
  const playLabel = hardModeComplete ? (hardDoneToday ? 'See Your Summary' : 'Play Hard Mode') : ctaLabel;
  const startPlay = () => {
    if (hardModeComplete) {
      navigate(hardDoneToday ? '/summary?mode=hard' : '/hard-mode');
      return;
    }
    void handlePlay();
  };

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const animation = animateSafe(playButtonRef.current, {
      scale: [1, 1.035, 1],
      duration: 420,
      ease: 'outCubic',
      onComplete: () => {
        playButtonRef.current?.style.removeProperty('transform');
      },
    });
    return () => {
      animation?.revert();
      playButtonRef.current?.style.removeProperty('transform');
    };
  }, [hardMode]);

  useEffect(() => {
    const values = scoreListRef.current?.querySelectorAll('[data-score-value]');
    if (!values?.length) return;
    const animation = animateSafe(values, {
      opacity: [0.35, 1],
      translateY: [5, 0],
      duration: 300,
      delay: stagger(45),
      ease: 'outCubic',
    });
    return () => {
      animation?.revert();
    };
  }, [hardMode, puzzle]);

  if (authState === 'unavailable') return <LandingShell><AuthUnavailable onRetry={retryAuth} /></LandingShell>;

  if (loading)
    return (
      <LandingShell onPlay={handlePlay} isComplete={isComplete}>
        <div>
          <p className="font-display text-4xl font-extrabold leading-none sm:text-5xl">
            Pulling today&apos;s questions.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 opacity-70">
            Three fresh estimates, straight from the notebook. Give it a second.
          </p>
        </div>
      </LandingShell>
    );

  return (
    <LandingShell onPlay={handlePlay} isComplete={isComplete}>
      <div>
        <h1 className="max-w-3xl font-display text-[2.6rem] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-7xl">
          <span className="hero-word" style={{ animationDelay: '0ms' }}>Make</span>{' '}
          <span className="hero-word" style={{ animationDelay: '70ms' }}>an</span>{' '}
          <span className="hero-word" style={{ animationDelay: '140ms' }}>
            <span className="marker-sweep">
              <span className="marker-sweep__base">educated</span>
              <span className="marker-sweep__ink mark" aria-hidden="true">educated</span>
            </span>
          </span>{' '}
          <span className="hero-word" style={{ animationDelay: '210ms' }}>guess.</span>
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 opacity-80 sm:text-lg">
          Three questions a day. Pick a number, lock it in, and find out how far off you were.
        </p>
      </div>

      <div className="mt-9 sm:mt-11">
        <div className="flex items-baseline justify-between gap-4 text-xs font-bold tracking-[0.03em]">
          {showHardRun ? (
            <span>
              {hardRun ? <>Last hard mode run<span className="opacity-55"> · Puzzle #{hardRun.puzzleNumber}</span></> : 'No hard mode runs yet'}
            </span>
          ) : (
            <span>
              {answeredCount} of {total} solved
              {puzzle && <span className="opacity-55"> · Puzzle #{puzzle.puzzle.puzzleNumber}</span>}
            </span>
          )}
          {isComplete && <span className="text-brand">All done</span>}
        </div>

        <ul ref={scoreListRef} className="mt-3 grid grid-cols-3 border-y-2 border-[var(--line-strong)]">
          {Array.from({ length: total }).map((_, index) => {
            const question = puzzle?.questions[index];
            const rawScore = (question && puzzle?.userGuesses[question.id]) || 0;
            const isHardGuess = question ? hardGuesses.has(question.id) : false;
            const hardScore = isHardGuess ? rawScore : hardRun?.results[index]?.score ?? 0;
            const visibleScore = !hardMode ? (isHardGuess ? 0 : rawScore) : hardScore;
            // an easy-mode box that was only played in hard mode stays empty
            const hidden = !hardMode && isHardGuess && rawScore > 0;

            return (
              <li
                key={question?.id ?? index}
                aria-label={
                  hidden
                    ? `Puzzle ${index + 1}: result hidden`
                    : visibleScore > 0
                      ? `Puzzle ${index + 1}: off by ${formatCompactNumber(visibleScore)} times${hardMode ? ' in hard mode' : ''}`
                      : hardMode
                        ? `Puzzle ${index + 1}: no hard mode score yet`
                        : `Puzzle ${index + 1}: not answered yet`
                }
                className="border-r border-[var(--line)] px-4 py-4 first:pl-0 last:border-r-0 last:pr-0 sm:px-6"
              >
                <span
                  aria-hidden="true"
                  className="block whitespace-nowrap text-[0.62rem] font-bold tracking-[0.03em] opacity-60"
                >
                  {`Q${index + 1} ${hidden ? 'played in hard mode' : 'off by'}`}
                </span>

                <span
                  data-score-value
                  aria-hidden="true"
                  className="mt-2 block font-display text-3xl font-extrabold leading-none tabular-nums sm:text-4xl"
                >
                  {visibleScore > 0 ? formatScore(visibleScore).visual : '\u2014'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p className="mt-6 border-l-4 border-brand pl-4 text-sm font-bold" role="alert">
          {error}
        </p>
      )}

      <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          ref={playButtonRef}
          type="button"
          onClick={startPlay}
          className="btn-primary w-full sm:w-auto sm:min-w-[17rem]"
          disabled={loading || authState === 'checking'}
          data-enter
        >
          {playLabel}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <HardModeToggle enabled={hardMode} onToggle={toggleHardMode} />
          {hardMode && (
            <span className="text-[0.68rem] font-bold tracking-[0.04em] text-brand">10 seconds per question</span>
          )}
          <p className="text-[0.68rem] font-bold tracking-[0.04em] opacity-45">No Googling.</p>
        </div>
      </div>
    </LandingShell>
  );
}

function LandingShell({ children, onPlay, isComplete }: { children: ReactNode; onPlay?: () => void; isComplete?: boolean }) {
  return (
    <>
      <div className="shell py-8 lg:py-12">
        <article className="front-page">
          <div className="px-5 py-7 sm:px-8 sm:py-10 lg:px-10">{children}</div>
        </article>
      </div>
      <HowToPlay />
      <Faqs />
      {onPlay && (
        <div className="shell-wide pb-16">
          <div className="flex flex-col gap-4 border-t-2 border-[var(--line-strong)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold tracking-[0.04em] opacity-55">Three questions. One shot each.</p>
            <button type="button" onClick={onPlay} className="btn-primary w-full sm:w-auto">
              {isComplete ? 'View your results' : "Start today's puzzle"} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
