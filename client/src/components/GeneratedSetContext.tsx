import type { GeneratedQuestionSetSummary } from 'shared';

export function GeneratedSetContext({ set }: { readonly set: GeneratedQuestionSetSummary }) {
  return (
    <section className="mb-6 space-y-2 break-words" aria-label="Generated set source">
      <span className="chip chip-idle">Generated set</span>
      <h2 className="font-display text-2xl font-bold">{set.title}</h2>
      <p className="text-sm text-hc-ink/70 dark:text-gray-300">{set.topic} · {set.difficulty ?? 'Any difficulty'} · 3 questions</p>
    </section>
  );
}
