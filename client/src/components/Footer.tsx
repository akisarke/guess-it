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

    <footer className="shell pb-8 pt-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="shrink-0">
          <Link to="/" className="font-display text-lg font-extrabold text-ink dark:text-gray-100">Guess It!</Link>
          <p className="mt-1 text-sm text-ink/70 dark:text-gray-300">Three guesses a day.</p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {footerLinks.map((link) => <Link key={link.to} to={link.to} className="nav-link">{link.label}</Link>)}
          <a href="https://hackclub.com" target="_blank" rel="noreferrer" className="nav-link gap-1">
            Hack Club
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </nav>

        <p className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-[0.08em]">
          © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
