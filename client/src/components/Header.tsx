import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { SoundToggle } from './SoundToggle';
import { ThemeToggle } from './ThemeToggle';
import type { AuthUser } from '../lib/api';
import { NotificationBell } from './NotificationBell';

const navItems = [
  {
    label: 'Play',
    to: '/',
    match: (pathname: string) => pathname === '/' || ['/play', '/reveal', '/summary'].some((prefix) => pathname.startsWith(prefix)),
  },
  { label: 'Leaderboard', to: '/leaderboard' },
  {
    label: 'Duels',
    to: '/duels',
    match: (pathname: string) => pathname.startsWith('/duels') || pathname.startsWith('/match'),
  },
  { label: 'Generate', to: '/generate' },
  { label: 'Profile', to: '/profile' },
];

const isActive = (item: (typeof navItems)[number], pathname: string) =>
  item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`);

export function Header() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const refreshUser = () => {
      void api.getMe().then((r) => setMe(r.user)).catch(() => setMe(null));
    };
    refreshUser();
    window.addEventListener('guessit:auth-changed', refreshUser);
    return () => window.removeEventListener('guessit:auth-changed', refreshUser);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await api.logout();
    setMe(null);
    window.dispatchEvent(new Event('guessit:auth-changed'));
  };

  return (
    <header className="site-header sticky top-0 z-20">
      <div className="shell flex h-16 items-center gap-3 sm:gap-6">
        <Link to="/" aria-label="Guess It! home" className="shrink-0 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          Guess It!
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-sound="nav"
              aria-current={isActive(item, pathname) ? 'page' : undefined}
              className="nav-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SoundToggle />
          <ThemeToggle />
          {me && me.authProvider !== 'anonymous' && <NotificationBell />}

          <div className="hidden items-center gap-2 lg:flex">
            {me ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="tactile-control inline-flex h-11 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-ink/70 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 dark:text-gray-300 dark:hover:text-white"
              >
                <LogOut size={15} aria-hidden="true" />
                <span>Log out</span>
              </button>
            ) : (
              <>
                <Link to="/login" className="whitespace-nowrap text-sm font-medium text-ink/70 transition-colors hover:text-ink dark:text-gray-300 dark:hover:text-white">
                  Sign in
                </Link>
                <Link to="/signup" className="btn-primary h-11 px-4 py-0 text-sm">
                  Create account
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" role="region" aria-label="Mobile navigation" className="shell pb-4 lg:hidden">
          <nav aria-label="Primary" className="flex flex-col border-t border-[var(--line)]">
            {navItems.map((item) => {
              const active = isActive(item, pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-sound="nav"
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center border-b border-[var(--line)] text-sm transition-colors',
                    active
                      ? 'font-bold text-ink dark:text-white'
                      : 'font-medium text-ink/60 hover:text-ink dark:text-gray-300 dark:hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 grid gap-2">
            {me ? (
              <button type="button" onClick={() => void handleLogout()} className="btn-secondary w-full">
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Link to="/login" className="btn-secondary w-full">Sign in</Link>
                <Link to="/signup" className="btn-primary w-full">Create account</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
