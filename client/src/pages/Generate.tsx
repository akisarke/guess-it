import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
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
    return <div className="max-w-lg mx-auto py-12 px-4"><div className="card"><NotLoggedIn feature="question generation" /></div></div>;
  }
  if (authState === 'unavailable') {
    return <div className="max-w-lg mx-auto py-12 px-4"><div className="card"><AuthUnavailable onRetry={retry} /></div></div>;
  }
  if (authState === 'verification-required') return <div className="max-w-lg mx-auto py-12 px-4"><div className="card"><EmailVerificationPending /></div></div>;

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

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="card">
        <h1 className="font-display text-3xl font-extrabold mb-6">Generate a Question</h1>

        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="generate-topic" className="block text-sm font-semibold text-hc-ink/70 dark:text-gray-300 mb-2">Topic</label>
            <input
              id="generate-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., space exploration, food, technology"
              className="w-full px-4 py-3 rounded-2xl border-2 border-hc-ink/10 dark:border-white/15 focus:outline-none focus:ring-4 focus:ring-hc-violet/30 focus:border-hc-violet bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label htmlFor="generate-difficulty" className="block text-sm font-semibold text-hc-ink/70 dark:text-gray-300 mb-2">
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
              className="w-full px-4 py-3 rounded-2xl border-2 border-hc-ink/10 dark:border-white/15 focus:outline-none focus:ring-4 focus:ring-hc-violet/30 focus:border-hc-violet bg-white dark:bg-gray-800"
            >
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {error instanceof ApiError && error.status === 401 ? <NotLoggedIn feature="question generation" /> : error && (
          <p className="text-red-500 text-sm mb-4" role="alert">
            {error.message}
            {error instanceof ApiError && error.status === 429 && error.resetAt ? ` Try again after ${error.resetAt}.` : ''}
          </p>
        )}

        <p className="text-sm font-semibold text-hc-ink/60 dark:text-gray-300 mb-4" role="status" aria-live="polite">
          {remainingGenerations === 0 ? 'No attempts remaining today' : `${remainingGenerations} attempt${remainingGenerations === 1 ? '' : 's'} remaining today`}
        </p>

        <button
          onClick={handleGenerate}
          disabled={loading || authState === 'checking' || !topic.trim() || remainingGenerations === 0}
          className="btn-primary w-full"
        >
          {loading ? 'Generating...' : 'Generate set'}
        </button>

        {generatedSet && (
          <section className="mt-6 space-y-4" aria-label="Generated question previews">
            <GeneratedSetContext set={generatedSet.set} />
            {generatedSet.questions.map((preview, index) => (
              <article key={preview.id} className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border-2 border-hc-ink/5 dark:border-white/10">
                <h2 className="font-display text-xl font-extrabold mb-2">Question {index + 1}</h2>
                <p className="font-semibold mb-2">{preview.prompt}</p>
                <p className="text-sm font-medium text-hc-ink/60 dark:text-gray-400">Unit: {preview.unit}</p>
              </article>
            ))}
            <Link
              to={`/sets/${encodeURIComponent(generatedSet.set.id)}/play/0`}
              className="btn-primary w-full"
            >
              Play set
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
