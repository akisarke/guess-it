import { useState } from 'react';
import type { ProfileBadge } from '../lib/api';
import { BadgeChip } from './BadgeChip';

const earnedFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function BadgeShelf({ badges, onTogglePin }: { badges: readonly ProfileBadge[]; onTogglePin?: (badgeId: string, currentlyPinned: boolean) => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = badges.find((badge) => badge.badgeId === activeId) ?? null;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <BadgeChip
            key={badge.badgeId}
            badgeId={badge.badgeId}
            name={badge.badge.name}
            description={badge.badge.description}
            isSecret={badge.badge.isSecret}
            isPinned={badge.isPinned}
            isActive={badge.badgeId === activeId}
            onActivate={() => setActiveId(badge.badgeId)}
            onTogglePin={onTogglePin ? () => onTogglePin(badge.badgeId, badge.isPinned) : undefined}
          />
        ))}
      </div>
      <p aria-live="polite" className="mt-4 min-h-[3.5rem] border-t border-[var(--line)] pt-3 text-sm leading-6 text-ink/75 dark:text-gray-300">
        {active ? (
          <>
            <strong className="text-ink dark:text-gray-100">{active.badge.name}</strong>
            {' · '}
            {active.badge.isSecret ? 'A secret badge.' : active.badge.description}
            <span className="block text-xs font-bold text-ink/70 dark:text-gray-400">Earned {earnedFormatter.format(new Date(active.grantedAt))}</span>
          </>
        ) : (
          <span className="text-ink/70 dark:text-gray-400">Hover, focus, or tap a badge to see how it was earned.</span>
        )}
      </p>
    </>
  );
}
