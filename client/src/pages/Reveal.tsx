import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSoloGame } from '../hooks/use-solo-game';
import { GeneratedSetContext } from '../components/GeneratedSetContext';
import { SoloLoadError } from '../components/SoloLoadError';
import { RevealView } from '../components/RevealView';
import { DistributionResponse, QuestionPublic } from 'shared';
import { play } from '../lib/sounds';
import { currentMode } from '../lib/daily-mode';

export function Reveal() {
  const navigate = useNavigate();
  const { puzzle, loading, error, idx, setId, prefix, query: puzzleQuery } = useSoloGame();
  const [dist, setDist] = useState<{ questionId: string; data: DistributionResponse } | null>(null);

  const question: QuestionPublic | null =
    puzzle && puzzle.questions && puzzle.questions[idx] ? puzzle.questions[idx] : null;
  const score = question && puzzle ? puzzle.userGuesses[question.id] ?? 0 : 0;
  const hasAnswered = question != null && score > 0;

  const distData = dist !== null && dist.questionId === question?.id ? dist.data : null;

  useEffect(() => {
    if (!question || !hasAnswered) return;
    let active = true;
    api
      .getDistribution(question.id, puzzle && puzzle.source?.kind === 'daily' ? currentMode() : undefined)
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
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="text-[0.68rem] font-bold tracking-[0.04em] opacity-55">Loading result</p>
        <div className="mt-3 border-t-2 border-[var(--line-strong)]" />
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
  const nextHref = idx < puzzle.questions.length - 1 ? `${prefix}/reveal/${idx + 1}${puzzleQuery}` : `${prefix}/summary`;
  const nextLabel = idx < puzzle.questions.length - 1 ? 'Next question' : 'See summary';
  const sourceLabel = 'set' in puzzle ? puzzle.set.title : `Puzzle #${puzzle.puzzle.puzzleNumber}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-8 lg:py-10" key={idx}>
      <RevealView
        unit={question.unit}
        score={score}
        userGuess={userGuess}
        answer={answer}
        distribution={distData}
        showDistribution={puzzle.source?.kind !== 'generated'}
        context={'set' in puzzle ? <GeneratedSetContext set={puzzle.set} /> : undefined}
        chips={
          <>
            <span className="reveal-chip">Question {idx + 1} of {puzzle.questions.length}</span>
            <span className="reveal-chip">{sourceLabel}</span>
          </>
        }
        actions={
          <>
            {idx > 0 && (
              <Link to={`${prefix}/reveal/${idx - 1}${puzzleQuery}`} className="btn-secondary w-full text-center sm:w-auto">
                Previous
              </Link>
            )}
            <Link to={nextHref} className="btn-primary w-full text-center sm:w-auto" data-enter>{nextLabel}</Link>
          </>
        }
      />
    </div>
  );
}
