import { Trash2 } from 'lucide-react';
import type { GeneratedQuestionSetSummary } from 'shared';

interface GeneratedSetContextProps {
  set: GeneratedQuestionSetSummary;
  onDelete?: () => void;
}

export function GeneratedSetContext({ set, onDelete }: GeneratedSetContextProps) {
  return (
    <section className="mb-6 space-y-2 break-words" aria-label="Generated set source">
      <div className="flex items-center justify-between gap-4">
        <span className="chip chip-idle">Generated set</span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-secondary px-3 py-1.5 text-xs gap-1"
            title="Delete this set"
          >
            <Trash2 size={12} aria-hidden="true" /> Delete
          </button>
        )}
      </div>
      <h2 className="font-display text-2xl font-bold">{set.title}</h2>
      <p className="text-sm text-ink/70 dark:text-gray-300">{set.topic} · {set.difficulty ?? 'Any difficulty'} · 3 questions</p>
    </section>
  );
}
