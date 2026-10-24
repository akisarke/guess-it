import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { GuessInput } from '../components/GuessInput';
import { Calculator } from '../components/Calculator';
import { play } from '../lib/sounds';
import type { QuestionPublic } from 'shared';
import { useSoloGame } from '../hooks/use-solo-game';
import { GeneratedSetContext } from '../components/GeneratedSetContext';
import { SoloLoadError } from '../components/SoloLoadError';

export function Question() {
  const navigate = useNavigate();
  const { puzzle, loading, error, idx, prefix, query: puzzleQuery, setId } = useSoloGame();
  const [showCalc, setShowCalc] = useState(false);
  const [guessValue, setGuessValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (setId !== undefined && error) return <SoloLoadError error={error} />;

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md space-y-4 text-center">
          <span className="chip chip-idle mx-auto">Loading</span>
          <div className="space-y-3">
            <div className="mx-auto h-8 w-40 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            <div className="mx-auto h-4 w-56 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
          </div>
        </div>
      </div>
    );
  if (!puzzle)
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md space-y-3 text-center">
          <span className="chip chip-idle mx-auto">No puzzle</span>
          <p className="font-display text-2xl font-bold text-ink dark:text-gray-100">No puzzle today</p>
          <p className="text-sm text-ink/60 dark:text-gray-300">Check back later for the next round.</p>
        </div>
      </div>
    );

  const firstUnansweredIndex = (puzzle.questions ?? []).findIndex((q) => !puzzle.userGuesses[q.id]);
  if (firstUnansweredIndex !== -1 && idx > firstUnansweredIndex) {
    return (
      <Redirecting
        href={`${prefix}/play/${firstUnansweredIndex}${puzzleQuery}`}
        navigate={navigate}
        chip="Play in order"
        title="Finish the previous round first"
        description="Jumping ahead is disabled. You'll return to your next unanswered question."
      />
    );
  }

  const question: QuestionPublic | undefined = puzzle.questions?.[idx];
  if (!question)
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md space-y-3 text-center">
          <span className="chip chip-idle mx-auto">Missing question</span>
          <p className="font-display text-2xl font-bold text-ink dark:text-gray-100">Question not found</p>
          <p className="text-sm text-ink/60 dark:text-gray-300">This round may have moved or been removed.</p>
        </div>
      </div>
    );

  if (puzzle.userGuesses[question.id]) {
    return <Redirecting href={`${prefix}/reveal/${idx}${puzzleQuery}`} navigate={navigate} chip="Already answered" title="Loading reveal" description="Taking you to the answer screen." />;
  }

  const handleSubmit = async (value: number) => {
    play('submit');
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.submitGuess({ source: puzzle.source, questionId: question.id, value });
      navigate(`${prefix}/reveal/${idx}${puzzleQuery}`);
    } catch (err) {
      play('error');
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="card overflow-hidden">
        {'set' in puzzle && <GeneratedSetContext set={puzzle.set} />}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="chip chip-idle">Question {idx + 1} of {puzzle.questions?.length ?? 3}</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {question.prompt}
            </h2>
            <p className="max-w-prose text-sm leading-6 text-ink/60 dark:text-gray-300 sm:text-base">
              Enter your best estimate, then lock it in.
            </p>
          </div>

          <div className="space-y-4">
            {submitError && <p role="alert" className="text-sm text-red-500">{submitError}</p>}
            <GuessInput
              unit={question.unit}
              value={guessValue}
              onChange={setGuessValue}
              onSubmit={handleSubmit}
              disabled={submitting}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowCalc(true)}
                className="btn-secondary flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Calculator
              </button>
              <button
                onClick={() => handleSubmit(guessValue)}
                disabled={submitting || guessValue <= 0}
                className="btn-primary w-full sm:flex-1"
                data-enter
              >
                {submitting ? 'Locking in...' : 'Lock it in'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCalc && (
        <Calculator
          onUseResult={(val) => {

            setGuessValue(Math.round(val));
            setShowCalc(false);
          }}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  );
}

function Redirecting({ href, navigate, chip, title, description }: {
  href: string;
  navigate: (to: string) => void;
  chip: string;
  title: string;
  description: string;
}) {
  useEffect(() => {
    navigate(href);
  }, [href, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="card w-full max-w-md space-y-4 text-center">
        <span className="chip chip-idle mx-auto">{chip}</span>
        <p className="font-display text-2xl font-bold text-ink dark:text-gray-100">{title}</p>
        <p className="text-sm text-ink/60 dark:text-gray-300">{description}</p>
      </div>
    </div>
  );
}
