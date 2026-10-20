import { Link } from 'react-router-dom';
import type { GeneratedQuestionSetSummary } from 'shared';

export function GeneratedSetsDisclosure({ sets }: { sets: readonly GeneratedQuestionSetSummary[] }) {
  return (
    <section className="mt-6 space-y-3 rounded-3xl border-2 border-ink/15 bg-white/75 p-5 dark:border-white/10 dark:bg-[var(--surface)]" aria-labelledby="generated-sets-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="chip chip-idle">Generated sets</span>
          <h2 id="generated-sets-heading" className="mt-2 font-display text-xl font-bold text-ink dark:text-gray-100">Question sets you made</h2>
          <p className="mt-1 text-sm leading-6 text-ink/70 dark:text-gray-300">Private answer keys stay protected while the set metadata remains visible here.</p>
        </div>
        <span className="chip chip-idle shrink-0">{sets.length} total</span>
      </div>
      {sets.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-ink/10 bg-white/60 px-4 py-5 text-sm leading-6 text-ink/70 dark:border-white/10 dark:bg-[var(--surface)] dark:text-gray-300">No generated sets yet. Create a three-question round from the Generate page.</p>
      ) : (
        <div className="space-y-2">
          {sets.map((set) => (
            <Link key={set.id} to={`/sets/${encodeURIComponent(set.id)}/summary`} className="group flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white/75 p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/40 dark:border-white/10 dark:bg-[var(--surface)] dark:hover:border-accent/50">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-bold text-ink dark:text-gray-100">{set.title}</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.09em] text-ink/55 dark:text-gray-400">{set.topic} · {set.difficulty ?? 'Any difficulty'} · {set.completed ? 'Completed' : 'In progress'}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-accent dark:text-accent">Open</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
