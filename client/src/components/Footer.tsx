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
    <footer className="shell mt-12 border-t-2 border-[var(--line-strong)] py-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="shrink-0">
          <Link to="/" className="font-display text-base font-extrabold tracking-[0.02em] text-ink dark:text-gray-100">Guess It!</Link>
          <p className="mt-1 max-w-xs text-sm text-ink/65 dark:text-gray-300">Three questions a day. No Googling.</p>
        </div>

        <div className="sm:text-right">
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
            {footerLinks.map((link) => (
              <Link key={link.to} to={link.to} className="nav-link min-h-0 text-xs">{link.label}</Link>
            ))}
            <a href="https://hackclub.com" target="_blank" rel="noreferrer" className="nav-link min-h-0 gap-1 text-xs">
              Hack Club
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </nav>
          <p className="mt-3 text-[0.62rem] font-bold tracking-[0.04em] text-ink/50 dark:text-gray-400">
            © {new Date().getFullYear()} Guess It!
          </p>
        </div>
      </div>
    </footer>
  );
}
