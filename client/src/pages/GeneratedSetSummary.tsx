import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GeneratedGameSummaryResponse } from 'shared';
import { api } from '../lib/api';
import { derivePuzzleProgress } from '../lib/puzzle-progress';
import { useSoloRoute } from '../hooks/use-solo-game';
import { GeneratedSetContext } from '../components/GeneratedSetContext';
import { SoloLoadError } from '../components/SoloLoadError';
import '../reveal.css';

export function GeneratedSetSummary() {
  const { setId, prefix } = useSoloRoute();
  const [state, setState] = useState<{ readonly id: string; readonly summary: GeneratedGameSummaryResponse | null; readonly error: Error | null } | null>(null);
  useEffect(() => {
    if (setId === undefined) return;
    let active = true;
    api.getQuestionSetSummary(setId).then((summary) => {
      if (active) setState({ id: setId, summary, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ id: setId, summary: null, error: error instanceof Error ? error : new Error('Unable to load summary.') });
    });
    return () => { active = false; };
  }, [setId]);
  const current = state?.id === setId ? state : null;
  if (current?.error) return <SoloLoadError error={current.error} />;
  const summary = current?.summary;
  if (!summary) return <div className="max-w-lg mx-auto px-4 py-12"><div className="card" role="status">Loading summary</div></div>;
  const progress = derivePuzzleProgress(summary);
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="reveal-canvas space-y-6">
        <GeneratedSetContext set={summary.set} />
        <h1 className="font-display text-4xl font-extrabold">Generated Summary</h1>
        <span className="chip chip-idle">Answered {progress.answeredCount}/3</span>
        <section className="reveal-metric">
          <h2 className="reveal-metric-label">Average score</h2>
          <p className="reveal-score">{summary.averageScore === null ? '—' : `${summary.averageScore.toFixed(2)}×`}</p>
          {!summary.completed && <p>Complete all three questions to see your average.</p>}
        </section>
        <ol className="space-y-3">
          {summary.questions.map((question, index) => {
            const score = summary.userGuesses[question.id];
            return (
              <li key={question.id} className="reveal-metric">
                <Link to={`${prefix}/${score ? 'reveal' : 'play'}/${index}`} className="block space-y-2" aria-label={`${score ? 'View result for' : 'Play'} question ${index + 1}`}>
                  <p className="font-bold break-words">{index + 1}. {question.prompt}</p>
                  <p>{score ? `${score}×` : 'Not played'} · {question.unit}</p>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-3">
          {!progress.isComplete && <Link className="btn-primary" to={`${prefix}/play/${progress.firstUnansweredIndex}`}>Continue set</Link>}
          <Link className="btn-secondary" to="/generate">Back to Generate</Link>
        </div>
      </div>
    </div>
  );
}
