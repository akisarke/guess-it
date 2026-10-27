import { badgeIconForId } from '../lib/badge-icons';

interface BadgeChipProps {
  name: string;
  badgeId?: string;
  description?: string;
  isSecret?: boolean;
  isPinned?: boolean;
  isActive?: boolean;
  onTogglePin?: () => void;
  // shows the badge's details; fires on hover, focus, and on tap when the chip can't pin
  onActivate?: () => void;
}

export function BadgeChip({ name, badgeId = '', description, isSecret, isPinned, isActive, onTogglePin, onActivate }: BadgeChipProps) {
  const interactive = Boolean(onTogglePin || onActivate);
  const className = `inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[2px] px-3 py-2 text-left text-xs font-bold leading-tight ${
    interactive ? 'min-h-11 transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-[0.96]' : ''
  } ${isPinned ? 'chip-active' : 'chip-idle'} ${isActive ? 'outline outline-2 outline-offset-2 outline-[var(--line-strong)]' : ''}`;
  const Icon = badgeIconForId(badgeId);
  const content = (
    <>
      <Icon size={16} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 whitespace-normal break-words">{name}</span>
    </>
  );
  const title = isSecret ? 'Secret badge' : description ?? name;

  if (onTogglePin) {
    return (
      <button type="button" onClick={onTogglePin} onFocus={onActivate} onMouseEnter={onActivate} data-sound="toggle" aria-label={`${isPinned ? 'Unpin' : 'Pin'} badge ${name}`} aria-pressed={isPinned} className={className} title={title}>
        {content}
      </button>
    );
  }
  if (onActivate) {
    return (
      <button type="button" onClick={onActivate} onFocus={onActivate} onMouseEnter={onActivate} aria-label={`About badge ${name}`} aria-expanded={isActive} className={className}>
        {content}
      </button>
    );
  }
  return <span className={className} title={title}>{content}</span>;
}
