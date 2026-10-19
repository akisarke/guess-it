import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { SoundToggle } from './SoundToggle';
import { ThemeToggle } from './ThemeToggle';
import { NavBar } from './ui/tubelight-navbar';
import { LogOut, Menu, X } from 'lucide-react';
import type { AuthUser } from '../lib/api';
import { NotificationBell } from './NotificationBell';

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
    <header className="site-header sticky top-0 z-20 border-b border-ink/10 bg-white/65 dark:border-white/10 dark:bg-gray-900/65">
      <div className="shell flex flex-col gap-1.5 py-1.5">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" aria-label="Guess It! home" className="shrink-0 font-display text-2xl font-extrabold tracking-tight">
            <span
              className="text-ink dark:text-gray-100"
>
              Guess It!
            </span>
          </Link>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <SoundToggle />
            <ThemeToggle />
            {me && me.authProvider !== 'anonymous' && <NotificationBell />}
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

        <div className="hidden lg:block">
          <div className="flex w-full items-center justify-between gap-2">
            <NavBar profileLabel={me?.authProvider === 'anonymous' ? undefined : me?.displayName} />
            {me ? (
              <button type="button" onClick={() => void handleLogout()} className="tactile-control inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border-2 border-ink/10 px-2.5 text-xs font-bold text-ink/70 hover:border-brand/30 hover:bg-brand/10 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"><LogOut size={15} aria-hidden="true" /><span>Log out</span></button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="tactile-control inline-flex h-11 items-center justify-center rounded-lg border-2 border-ink/10 px-4 text-sm font-bold text-ink/70 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 dark:border-white/15 dark:text-gray-300">
                  Sign in
                </Link>
                <Link to="/signup" className="btn-primary inline-flex h-11 items-center px-4 py-1 text-sm">
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-navigation" role="region" aria-label="Mobile navigation" className="space-y-3 rounded-3xl border-2 border-ink/10 bg-white/75 p-3 dark:border-white/10 dark:bg-[var(--surface)] lg:hidden">
            <NavBar profileLabel={me?.authProvider === 'anonymous' ? undefined : me?.displayName} showLabels mobile className="w-full" />
            <div className="grid gap-2 sm:grid-cols-2">
              {!me && <Link to="/login" className="btn-secondary w-full">Sign in</Link>}
              {!me && <Link to="/signup" className="btn-primary w-full">Create account</Link>}
              {me && (

                <button type="button" onClick={() => void handleLogout()} className="btn-secondary w-full sm:col-span-2">
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
