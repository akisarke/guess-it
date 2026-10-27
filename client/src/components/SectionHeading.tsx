import type { ReactNode } from 'react';

export function SectionHeading({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-[var(--line-strong)] pb-3">
      <h2 id={id} className="font-display text-xl font-extrabold tracking-tight text-ink dark:text-gray-100 sm:text-2xl">
        {title}
      </h2>
      {aside !== undefined && <span className="shrink-0 text-xs font-bold tabular-nums opacity-60">{aside}</span>}
    </div>
  );
}
