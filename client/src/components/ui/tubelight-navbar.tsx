import { motion, useReducedMotion } from 'motion/react';
import { Home, Trophy, Swords, Sparkles, User, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

interface NavBarProps {
  items?: NavItem[];
  profileLabel?: string;
  className?: string;
  mobile?: boolean;
  showLabels?: boolean;
}

const startsWithAny =
  (...prefixes: string[]) =>
  (pathname: string): boolean =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const navItems: NavItem[] = [
  { name: 'Play', url: '/', icon: Home, match: startsWithAny('/', '/play', '/reveal', '/summary') },
  { name: 'Leaderboard', url: '/leaderboard', icon: Trophy },
  { name: 'Duels', url: '/duels', icon: Swords, match: startsWithAny('/duels', '/match') },
  { name: 'Generate', url: '/generate', icon: Sparkles },
  { name: 'Profile', url: '/profile', icon: User },
];

export function NavBar({ items = navItems, profileLabel, className, mobile = false, showLabels = false }: NavBarProps) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn('flex justify-center', className)}>
      <nav
        aria-label="Primary"
        className={cn(
          'flex items-center gap-1 border-2 border-hc-ink/10 bg-white/70 shadow-[0_14px_30px_-18px_rgba(28,27,36,0.4)] backdrop-blur-lg dark:border-white/10 dark:bg-white/10',
          mobile ? 'w-full flex-wrap justify-start rounded-2xl p-2' : 'rounded-full px-1 py-0.5',
        )}
      >
        {items.map((item) => {
          const displayItem = item.name === 'Profile' && profileLabel ? { ...item, name: profileLabel } : item;
          const Icon = displayItem.icon;
          const isActive = displayItem.match ? displayItem.match(pathname) : pathname === displayItem.url;

          return (
            <Link
              key={displayItem.url}
              to={displayItem.url}
              aria-current={isActive ? 'page' : undefined}
              aria-label={displayItem.name}
              title={displayItem.name}
              className={cn(
                'relative flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-hc-violet/40 sm:px-5',
                'text-hc-ink/60 hover:text-hc-ink dark:text-gray-300 dark:hover:text-white',
                isActive && 'text-hc-ink dark:text-white',
              )}
            >
              <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
              <span className={cn('max-w-[9rem] truncate', showLabels ? 'inline' : 'hidden lg:inline')}>{displayItem.name}</span>
              {isActive &&
                (reduceMotion ? (
                  <div className="absolute inset-0 -z-10 w-full rounded-full bg-hc-pink/10 dark:bg-white/10">
                    <div
                      className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-gradient-to-r from-hc-pink to-hc-peach"                    />
                  </div>
                ) : (
                  <motion.div
                    layoutId="tubelight-lamp"
                    className="absolute inset-0 -z-10 w-full rounded-full bg-hc-pink/10 dark:bg-white/10"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                  <div
                    className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-gradient-to-r from-hc-pink to-hc-peach"
                    >
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-hc-pink/25 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-hc-peach/25 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-hc-pink/25 blur-sm" />
                  </div>
                  </motion.div>
                )
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
