import { Home, Trophy, Swords, Plus, User, type LucideIcon } from 'lucide-react';
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
  { name: 'Generate', url: '/generate', icon: Plus },
  { name: 'Profile', url: '/profile', icon: User },
];

export function NavBar({ items = navItems, profileLabel, className, mobile = false, showLabels = false }: NavBarProps) {
  const { pathname } = useLocation();

  return (
    <div className={cn('flex justify-center', className)}>
      <nav
        aria-label="Primary"
        className={cn(
          'flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1',
          mobile && 'w-full flex-wrap justify-start',
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
              data-sound="nav"
              aria-current={isActive ? 'page' : undefined}
              aria-label={displayItem.name}
              title={displayItem.name}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/60 sm:px-5',

                isActive
                  ? 'bg-accent text-accent-ink hover:bg-accent hover:text-accent-ink'
                  : 'text-ink/60 hover:bg-ink/5 hover:text-ink dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-gray-100',
              )}
            >
              <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
              <span className={cn('max-w-[9rem] truncate', showLabels ? 'inline' : 'hidden lg:inline')}>{displayItem.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
