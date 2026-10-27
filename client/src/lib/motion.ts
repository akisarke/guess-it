export type SwipeDirection = 'forward' | 'back' | 'none';

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Slides content in from the side it's "coming from": forward enters from the
// right, back from the left, and an unordered change just rises into place.
// Reduced-motion users get a plain crossfade instead of movement.
export function swipeIn(element: HTMLElement | null, direction: SwipeDirection): Animation | null {
  if (!element || typeof element.animate !== 'function') return null;
  if (prefersReducedMotion()) {
    return element.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180, easing: 'linear' });
  }
  const from = direction === 'forward' ? 'translateX(48px)' : direction === 'back' ? 'translateX(-48px)' : 'translateY(10px)';
  return element.animate(
    [
      { opacity: 0, transform: from },
      { opacity: 1, transform: 'none' },
    ],
    { duration: direction === 'none' ? 280 : 340, easing: EASE_OUT },
  );
}

export function directionBetween(previous: number, next: number): SwipeDirection {
  if (next > previous) return 'forward';
  if (next < previous) return 'back';
  return 'none';
}

// Where a path sits in the site's reading order: the nav sections left to
// right, and inside a game, question → reveal → next question → summary.
export function routeOrder(pathname: string): number {
  const step = (index: string | undefined, offset: number) => 1 + Number(index ?? 0) * 2 + offset;
  const play = pathname.match(/\/play\/(\d+)/);
  const reveal = pathname.match(/\/reveal\/(\d+)/);

  if (pathname === '/') return 0;
  if (play) return step(play[1], 0) / 100;
  if (reveal) return step(reveal[1], 1) / 100;
  if (pathname.endsWith('/summary') || pathname === '/hard-mode') return 0.9;
  if (pathname.startsWith('/leaderboard')) return 1;
  if (pathname.startsWith('/duels') || pathname.startsWith('/match')) return 2;
  if (pathname.startsWith('/generate') || pathname.startsWith('/sets')) return 3;
  if (pathname.startsWith('/profile') || pathname.startsWith('/u/')) return 4;
  if (pathname.startsWith('/admin')) return 5;
  return -1;
}
