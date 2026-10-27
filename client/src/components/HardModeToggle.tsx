import { useEffect, useRef } from 'react';
import { animateSafe } from '../lib/anime';

interface HardModeToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function HardModeToggle({ enabled, onToggle }: HardModeToggleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const animation = animateSafe(thumbRef.current, {
      x: enabled ? 10 : 0,
      duration: 260,
      ease: 'outBack',
    });
    return () => {
      animation?.pause();
    };
  }, [enabled]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const animation = animateSafe(buttonRef.current, {
      scale: [1, 1.06, 1],
      duration: 320,
      ease: 'outCubic',
    });
    return () => {
      animation?.revert();
    };
  }, [enabled]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={`hard-mode-toggle inline-flex items-center gap-2 border px-2 py-1 text-[0.66rem] font-bold tracking-[0.04em] transition-colors ${enabled ? 'border-brand bg-brand/10 text-brand' : 'border-[var(--line-strong)] text-ink/55 hover:text-ink dark:text-gray-400 dark:hover:text-white'}`}
    >
      <span aria-hidden="true" className="hard-mode-toggle__track">
        <span ref={thumbRef} aria-hidden="true" className="hard-mode-toggle__thumb" />
      </span>
      <span>Hard mode{enabled ? ' · 10s' : ''}</span>
    </button>
  );
}
