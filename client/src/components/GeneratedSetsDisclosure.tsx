import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { GeneratedQuestionSetSummary } from 'shared';
import { SectionHeading } from './SectionHeading';

// ownerName is set when someone else is looking at the profile
export function GeneratedSetsDisclosure({ sets, onDelete, ownerName }: { sets: readonly GeneratedQuestionSetSummary[]; onDelete?: (id: string) => void; ownerName?: string }) {
  if (ownerName && sets.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="generated-sets-heading">
      <SectionHeading id="generated-sets-heading" title={ownerName ? `Question sets ${ownerName} made` : 'Question sets you made'} aside={`${sets.length} total`} />
      {!ownerName && <p className="mt-3 text-sm leading-6 text-ink/70 dark:text-gray-300">Answers stay hidden from everyone else. Only the title and topic show here.</p>}
      {sets.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-ink/70 dark:text-gray-300">
          No generated sets yet. Create a three-question round from the <Link to="/generate" className="font-bold text-ink underline decoration-accent decoration-2 underline-offset-4 dark:text-gray-100">Generate page</Link>.
        </p>
      ) : (
        <ul className="mt-3">
          {sets.map((set) => (
            <li key={set.id} className="group flex items-center gap-3 border-b border-[var(--line)] py-3">
              <Link to={`/sets/${encodeURIComponent(set.id)}/summary`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40">
                <span className="block break-words font-bold text-ink underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-accent dark:text-gray-100">{set.title}</span>
                <span className="mt-1 block text-xs font-bold tracking-[0.02em] text-ink/55 dark:text-gray-400">{set.topic} · {set.difficulty ?? 'Any difficulty'} · {set.completed ? 'Completed' : 'In progress'}</span>
              </Link>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(set.id)}
                  className="btn-secondary shrink-0 gap-1 px-3 py-1.5 text-xs"
                  aria-label={`Delete ${set.title}`}
                >
                  <Trash2 size={12} aria-hidden="true" /> Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
