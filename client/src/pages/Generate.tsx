import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, needsAccount } from '../lib/api';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { EmailVerificationPending } from '../components/EmailVerificationPending';
import { GeneratedSetContext } from '../components/GeneratedSetContext';
import { useAuthGate } from '../hooks/use-auth-gate';
import type { GenerateQuestionSetResponse, GenerateQuestionSetRequest } from 'shared';

type DifficultySelection = Exclude<GenerateQuestionSetRequest['difficulty'], null> | '';
const DAILY_GENERATION_LIMIT = 3;

export function Generate() {
  const { state: authState, retry } = useAuthGate();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultySelection>('');
  const [generatedSet, setGeneratedSet] = useState<GenerateQuestionSetResponse | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState(DAILY_GENERATION_LIMIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (authState === 'signed-out') {
    return <div className="max-w-lg mx-auto py-12 px-4"><NotLoggedIn feature="question generation" /></div>;
  }
  if (authState === 'unavailable') {
    return <div className="max-w-lg mx-auto py-12 px-4"><AuthUnavailable onRetry={retry} /></div>;
  }
  if (authState === 'verification-required') return <div className="max-w-lg mx-auto py-12 px-4"><EmailVerificationPending /></div>;

  const handleGenerate = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic || loading || remainingGenerations === 0) return;
    setLoading(true);
    setError(null);
    try {
      const input: GenerateQuestionSetRequest = { topic: trimmedTopic, difficulty: difficulty || null };
      const result = await api.generateQuestionSet(input);
      setGeneratedSet(result);
      setRemainingGenerations(result.remainingGenerations);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'GENERATION_QUOTA_EXCEEDED') {
        setRemainingGenerations(0);
      }
      setError(err instanceof Error ? err : new Error('Failed to generate'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!confirm('Delete this generated set?')) return;
    try {
      await api.deleteGeneratedSet(setId);
      setGeneratedSet(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Failed to delete set'));
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Generate a Question</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-ink/60 dark:text-gray-300 sm:text-base">
          Pick a topic. We'll write the questions; you bring the estimate.
        </p>
      </header>

      <div className="card">
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="generate-topic" className="block text-sm font-bold text-ink/70 dark:text-gray-300 mb-2">Topic</label>
            <input
              id="generate-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              placeholder="e.g., space exploration, food, technology"
              className="w-full px-4 py-3 rounded-lg border bg-[var(--surface)] border-[var(--line)] focus:outline-none focus:ring-4 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="generate-difficulty" className="block text-sm font-bold text-ink/70 dark:text-gray-300 mb-2">
              Difficulty (optional)
            </label>
            <select
              id="generate-difficulty"
              value={difficulty}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'easy' || value === 'medium' || value === 'hard') setDifficulty(value);
                else setDifficulty('');
              }}
              className="w-full px-4 py-3 rounded-lg border bg-[var(--surface)] border-[var(--line)] focus:outline-none focus:ring-4 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {needsAccount(error) ? <NotLoggedIn feature="question generation" /> : error && (
          <p className="text-red-500 text-sm mb-4" role="alert">
            {error.message}
            {error instanceof ApiError && error.status === 429 && error.resetAt ? (
              <span> Try again after {new Date(error.resetAt).toLocaleDateString()}.</span>
            ) : ''}
          </p>
        )}

        <p className="text-sm font-bold text-ink/60 dark:text-gray-300 mb-4" role="status" aria-live="polite">
          {remainingGenerations === 0 ? 'No attempts left today' : `${remainingGenerations} attempt${remainingGenerations === 1 ? '' : 's'} left`}
        </p>

        <button
          onClick={handleGenerate}
          disabled={loading || authState === 'checking' || !topic.trim() || remainingGenerations === 0}
          className="btn-primary w-full"
          data-enter={generatedSet ? undefined : true}
        >
          {loading ? 'Generating...' : 'Generate set'}
        </button>

        {generatedSet && (
          <section className="mt-6 space-y-4" aria-label="Generated question previews">
            <GeneratedSetContext set={generatedSet.set} onDelete={() => handleDeleteSet(generatedSet.set.id)} />
            {generatedSet.questions.map((preview, index) => (
              <article key={preview.id} className="p-4 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                <h2 className="font-display text-lg font-extrabold mb-2">Question {index + 1}</h2>
                <p className="text-sm font-bold mb-2">{preview.prompt}</p>
                <p className="text-xs font-medium text-ink/60 dark:text-gray-400">Unit: {preview.unit}</p>
              </article>
            ))}
            <Link
              to={`/sets/${encodeURIComponent(generatedSet.set.id)}/play/0`}
              className="btn-primary w-full"
              data-enter
            >
              Play set
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
