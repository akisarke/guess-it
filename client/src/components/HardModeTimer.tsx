import { useEffect, useRef, useState } from 'react';
import { animateSafe } from '../lib/anime';
import { HARD_MODE_SECONDS } from '../lib/hard-mode';

export function HardModeTimer({ onExpire }: { onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(HARD_MODE_SECONDS);
  const timerRef = useRef<HTMLSpanElement>(null);
  const expire = useRef(onExpire);
  const expired = useRef(false);
  expire.current = onExpire;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft !== 0 || expired.current) return;
    expired.current = true;
    expire.current();
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 || secondsLeft > 3) return;
    const animation = animateSafe(timerRef.current, {
      scale: [1, 1.18, 1],
      duration: 300,
      ease: 'outCubic',
    });
    return () => {
      animation?.revert();
    };
  }, [secondsLeft]);

  return (
    <span
      ref={timerRef}
      role="timer"
      aria-live="off"
      aria-label={`Hard mode: ${secondsLeft} seconds left`}
      className={`font-mono text-sm font-bold tabular-nums ${secondsLeft <= 3 ? 'text-brand' : 'text-ink/70 dark:text-gray-300'}`}
    >
      {secondsLeft}s
    </span>
  );
}
