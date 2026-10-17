import { Link } from 'react-router-dom';
import type { GeneratedQuestionSetSummary } from 'shared';

export function GeneratedSetsDisclosure({ sets }: { readonly sets: readonly GeneratedQuestionSetSummary[] }) {
  return (
    <section className="mt-6 space-y-3 rounded-3xl border-2 border-hc-ink/15 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5" aria-labelledby="generated-sets-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="chip chip-idle">Generated sets</span>
          <h2 id="generated-sets-heading" className="mt-2 font-display text-xl font-bold text-hc-ink dark:text-gray-100">Question sets made with AI</h2>
          <p className="mt-1 text-sm leading-6 text-hc-ink/70 dark:text-gray-300">Private answer keys stay protected while the set metadata remains visible here.</p>
        </div>
        <span className="chip chip-idle shrink-0">{sets.length} total</span>
      </div>
      {sets.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-hc-ink/10 bg-white/60 px-4 py-5 text-sm leading-6 text-hc-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">No generated sets yet. Create a three-question round from the Generate page.</p>
      ) : (
        <div className="space-y-2">
          {sets.map((set) => (
            <Link key={set.id} to={`/sets/${encodeURIComponent(set.id)}/summary`} className="group flex items-center gap-3 rounded-2xl border-2 border-hc-ink/10 bg-white/75 p-3 text-left transition hover:-translate-y-0.5 hover:border-hc-violet/40 dark:border-white/10 dark:bg-white/5 dark:hover:border-hc-violet/50">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold text-hc-ink dark:text-gray-100">{set.title}</span>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.14em] text-hc-ink/55 dark:text-gray-400">{set.topic} · {set.difficulty ?? 'Any difficulty'} · {set.completed ? 'Completed' : 'In progress'}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-hc-violet dark:text-hc-yellow">Open</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
