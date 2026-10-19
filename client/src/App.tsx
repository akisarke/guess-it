import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { NotFound } from './pages/NotFound';
import { VerifyEmail } from './pages/VerifyEmail';
import { Legal } from './pages/Legal';
import { CookieNotice } from './components/CookieNotice';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Landing } from './pages/Landing';

const Question = lazy(() => import('./pages/Question').then((module) => ({ default: module.Question })));
const Reveal = lazy(() => import('./pages/Reveal').then((module) => ({ default: module.Reveal })));
const Summary = lazy(() => import('./pages/Summary').then((module) => ({ default: module.Summary })));
const GeneratedSetSummary = lazy(() => import('./pages/GeneratedSetSummary').then((module) => ({ default: module.GeneratedSetSummary })));
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then((module) => ({ default: module.Leaderboard })));
const Matchmaking = lazy(() => import('./pages/Matchmaking').then((module) => ({ default: module.Matchmaking })));
const Duels = lazy(() => import('./pages/Duels').then((module) => ({ default: module.Duels })));
const DuelBattle = lazy(() => import('./pages/DuelBattle').then((module) => ({ default: module.DuelBattle })));
const DuelChallenge = lazy(() => import('./pages/DuelChallenge').then((module) => ({ default: module.DuelChallenge })));
const Generate = lazy(() => import('./pages/Generate').then((module) => ({ default: module.Generate })));
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })));
const Auth = lazy(() => import('./pages/Auth').then((module) => ({ default: module.Auth })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((module) => ({ default: module.ResetPassword })));

const routeMetadata = [
  { matches: (path: string) => path === '/', title: 'Guess It! — estimate, compare, improve', description: 'Guess It! is a daily estimation game for curious people. Make a guess, see how close you got, and play again tomorrow.' },
  { matches: (path: string) => path.startsWith('/play/'), title: 'Play — Guess It!', description: 'Make an estimate, lock it in, and see how close you get.' },
  { matches: (path: string) => path.startsWith('/reveal/'), title: 'Result — Guess It!', description: 'See your Guess It! result, score, and how close your estimate landed.' },
  { matches: (path: string) => path === '/summary' || path.includes('/summary'), title: 'Summary — Guess It!', description: 'Review your Guess It! puzzle results and keep building your instinct.' },
  { matches: (path: string) => path.startsWith('/profile') || path.startsWith('/u/'), title: 'Profile — Guess It!', description: 'View Guess It! streaks, badges, and generated question sets.' },
  { matches: (path: string) => path.startsWith('/leaderboard'), title: 'Leaderboard — Guess It!', description: 'Compare Guess It! scores across daily, weekly, and all-time boards.' },
  { matches: (path: string) => path.startsWith('/duels') || path.startsWith('/match'), title: 'Duels — Guess It!', description: 'Match with another player for a live Guess It! estimation battle.' },
  { matches: (path: string) => path.startsWith('/generate'), title: 'Generate — Guess It!', description: 'Create a fresh Guess It! question set around a topic you choose.' },
  { matches: (path: string) => path.startsWith('/login'), title: 'Sign in — Guess It!', description: 'Sign in to save your Guess It! progress and keep your best guesses together.' },
  { matches: (path: string) => path.startsWith('/signup'), title: 'Create account — Guess It!', description: 'Create a Guess It! account and keep your daily estimation streak alive.' },
  { matches: (path: string) => path.startsWith('/forgot-password'), title: 'Forgot password — Guess It!', description: 'Request a secure Guess It! password reset link.' },
  { matches: (path: string) => path.startsWith('/reset-password'), title: 'Reset password — Guess It!', description: 'Choose a new password for your Guess It! account.' },
  { matches: (path: string) => path.startsWith('/verify-email'), title: 'Verify email — Guess It!', description: 'Verify your Guess It! email address.' },
  { matches: (path: string) => path === '/privacy', title: 'Privacy Policy — Guess It!', description: 'Read the Guess It! privacy policy.' },
  { matches: (path: string) => path === '/terms', title: 'Terms of Service — Guess It!', description: 'Read the Guess It! terms of service.' },
  { matches: (path: string) => path === '/cookies', title: 'Cookie Policy — Guess It!', description: 'Read the Guess It! cookie policy.' },
  { matches: (path: string) => path.startsWith('/admin'), title: 'Owner tools — Guess It!', description: 'Manage Guess It! owner badge tools.' },
];

function PageMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = routeMetadata.find((entry) => entry.matches(pathname)) ?? {
      title: 'Page not found — Guess It!',
      description: 'The Guess It! page you requested could not be found.',
    };
    document.title = metadata.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', metadata.description);
  }, [pathname]);

  return null;
}

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="card space-y-5 overflow-hidden text-center sm:space-y-6">
        <span className="chip chip-idle mx-auto">Loading</span>
        <div className="space-y-3">
          <div className="mx-auto h-12 w-48 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)] sm:h-14 sm:w-56" />
          <div className="mx-auto h-5 w-full max-w-lg animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
          <div className="mx-auto h-5 w-5/6 max-w-md animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="sr-only z-50 rounded-md bg-accent text-accent-ink px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <Header />
        <PageMetadata />
        <div id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
          <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/play/:questionIndex" element={<Question />} />
              <Route path="/reveal/:questionIndex" element={<Reveal />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/sets/:setId/play/:questionIndex" element={<Question />} />
              <Route path="/sets/:setId/reveal/:questionIndex" element={<Reveal />} />
              <Route path="/sets/:setId/summary" element={<GeneratedSetSummary />} />
              <Route path="/u/:handle" element={<Profile />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/match" element={<Matchmaking />} />
              <Route path="/duels" element={<Duels />} />
              <Route path="/duels/challenge/:token" element={<DuelChallenge />} />
              <Route path="/duels/:duelId" element={<DuelBattle />} />
              <Route path="/generate" element={<Generate />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/login" element={<Auth mode="login" />} />
              <Route path="/signup" element={<Auth mode="signup" />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/privacy" element={<Legal kind="privacy" />} />
              <Route path="/terms" element={<Legal kind="terms" />} />
              <Route path="/cookies" element={<Legal kind="cookies" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </div>
        <Footer />
        <CookieNotice />
      </div>
    </BrowserRouter>
  );
}

export default App;
