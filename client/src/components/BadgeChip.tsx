import { playTick } from '../lib/sounds';
import { badgeIconForId } from '../lib/badge-icons';

interface BadgeChipProps {
  name: string;
  badgeId?: string;
  isSecret?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export function BadgeChip({ name, badgeId = '', isSecret, isPinned, onTogglePin }: BadgeChipProps) {
  const handleToggle = () => {
    playTick();
    onTogglePin?.();
  };

  const className = `inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 py-2 text-left text-xs font-semibold leading-tight ${
    onTogglePin ? 'min-h-11 transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-hc-violet/40 active:scale-[0.96]' : ''
  } ${isPinned ? 'chip-active' : 'chip-idle'}`;
  const content = (
    <>
      {(() => { const Icon = badgeIconForId(badgeId); return <Icon size={16} className="shrink-0" aria-hidden="true" />; })()}
      <span className="min-w-0 whitespace-normal break-words">{name}</span>
    </>
  );

  if (!onTogglePin) return <span className={className} title={isSecret ? 'Secret badge' : name}>{content}</span>;

  return (
    <button type="button" onClick={handleToggle} aria-label={`${isPinned ? 'Unpin' : 'Pin'} badge ${name}`} aria-pressed={isPinned} className={className} title={isSecret ? 'Secret badge' : name}>
      {content}
    </button>
  );
}
