import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Profile', to: '/profile' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Cookies', to: '/cookies' },
];

export function Footer() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-4xl px-4 pb-8 pt-4">
      <div className="flex flex-col gap-4 rounded-3xl border-2 border-hc-ink/10 bg-white/55 px-5 py-4 text-sm text-hc-ink/65 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="font-display text-lg font-extrabold text-hc-ink dark:text-gray-100">Guess It!</Link>
          <p className="mt-1">A small daily ritual for curious people.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {footerLinks.map((link) => <Link key={link.to} to={link.to} className="nav-link">{link.label}</Link>)}
          <a href="https://hackclub.com" target="_blank" rel="noreferrer" className="nav-link inline-flex items-center gap-1">
            Hack Club
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </nav>
        <p className="text-xs font-semibold uppercase tracking-[0.12em]">© {new Date().getFullYear()} Guess It!</p>
      </div>
    </footer>
  );
}
