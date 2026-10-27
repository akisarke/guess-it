import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { directionBetween, routeOrder, swipeIn } from '../lib/motion';

// Swipes each new page in from the side it's coming from, without remounting
// it, so moving between questions doesn't refetch anything.
export function RouteFade({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const last = previous.current;
    previous.current = pathname;
    if (last === null) return;
    const from = routeOrder(last);
    const to = routeOrder(pathname);
    // pages outside the ordering (login, terms, ...) just rise in
    const direction = from < 0 || to < 0 ? 'none' : directionBetween(from, to);
    const animation = swipeIn(ref.current, direction);
    return () => animation?.cancel();
  }, [pathname]);

  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
