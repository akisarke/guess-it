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
    <footer className="shell mt-10 border-t border-[var(--line)] py-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="shrink-0">
          <Link to="/" className="font-display text-base font-extrabold text-ink dark:text-gray-100">Guess It!</Link>
          <p className="mt-1 text-sm text-ink/65 dark:text-gray-300">Three questions a day. No Googling.</p>
        </div>

        <div className="sm:text-right">
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
            {footerLinks.map((link) => (
              <Link key={link.to} to={link.to} className="nav-link min-h-0 text-sm">{link.label}</Link>
            ))}
            <a href="https://hackclub.com" target="_blank" rel="noreferrer" className="nav-link min-h-0 gap-1 text-sm">
              Hack Club
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </nav>
          <p className="mt-2 text-xs font-bold tracking-[0.08em] text-ink/55 dark:text-gray-400">
            © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
