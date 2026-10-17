import { useState } from 'react';
import { isMuted, setMuted, playClick } from '../lib/sounds';

export function SoundToggle() {
  const [muted, setM] = useState(() => isMuted());

  const toggle = () => {
    const newMuted = !muted;
    setM(newMuted);
    setMuted(newMuted);
    if (!newMuted) playClick();
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-hc-ink/70 transition-colors hover:bg-hc-ink/5 hover:text-hc-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-hc-violet/40 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {muted ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </button>
  );
}
