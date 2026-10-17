import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { HackClubLogin } from '../components/HackClubLogin';
import { api } from '../lib/api';
import { EmailVerificationPending } from '../components/EmailVerificationPending';

type AuthMode = 'login' | 'signup';
type FormState = { displayName: string; email: string; password: string; confirmPassword: string };

const initialForm: FormState = { displayName: '', email: '', password: '', confirmPassword: '' };

function validate(form: FormState, mode: AuthMode): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.';
  if (form.password.length < 8) return 'Use at least 8 characters for your password.';
  if (form.password.length > 128) return 'Use a password shorter than 128 characters.';
  if (mode === 'signup' && (form.displayName.trim().length < 2 || form.displayName.trim().length > 32)) {
    return 'Choose a display name between 2 and 32 characters.';
  }
  if (mode === 'signup' && form.password !== form.confirmPassword) return 'Your passwords do not match.';
  return null;
}

export function Auth({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const isSignup = mode === 'signup';

  const update = (field: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate(form, mode);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
       if (isSignup) {
         const response = await api.signup(form.displayName.trim(), form.email.trim(), form.password);
          if (response.pendingVerification) setPendingVerification(true);
          else navigate(response.migratedFromAnonymous ? '/profile?upgraded=1' : '/');
       } else {
          const response = await api.login(form.email.trim(), form.password);
          if (response.pendingVerification) setPendingVerification(true);
          else navigate('/');
       }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not complete that request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-story" aria-label="About Guess It!">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-hc-ink dark:text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hc-yellow text-hc-ink">F</span>
            Guess It!
          </Link>

          <div className="mt-8 max-w-md sm:mt-10 lg:mt-24">
            <span className="chip border-2 border-hc-ink/10 bg-hc-ink/5 text-hc-ink/70 dark:border-white/15 dark:bg-white/10 dark:text-white/80">
              <Sparkles size={15} aria-hidden="true" />
              A daily ritual for curious minds
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[0.96] tracking-tight sm:text-6xl">
              Make a guess.
              <br />
              <span className="text-hc-yellow">Stay curious.</span>
            </h1>
            <p className="mt-4 max-w-sm text-base leading-7 text-hc-ink/65 sm:mt-5 sm:text-lg dark:text-white/70">
              Guess It! turns rough estimates into a small, satisfying game you can return to every day.
            </p>
          </div>

          <div className="mt-7 grid max-w-md gap-3 sm:mt-8 sm:grid-cols-2 lg:mt-20">
            {['One new puzzle daily', 'See how close you got', 'Build a better instinct', 'Keep your streak alive'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-semibold text-hc-ink/70 dark:text-white/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hc-mint text-hc-ink">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="chip chip-active">{isSignup ? 'New account' : 'Welcome back'}</span>
          </div>

           {pendingVerification ? <EmailVerificationPending email={form.email.trim()} /> : <div className="mt-8 max-w-md">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-hc-ink dark:text-gray-100 sm:text-4xl">
              {isSignup ? 'Create your account' : 'Sign in to Guess It!'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-hc-ink/60 dark:text-gray-300">
              {isSignup ? 'Save your progress and keep your best guesses together.' : 'Pick up where you left off and see today’s result.'}
            </p>
           </div>}

           {!pendingVerification && <form className="mt-8 max-w-md space-y-4" onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-hc-ink dark:text-gray-100">Display name</span>
                <span className="auth-field">
                  <UserRound size={18} className="auth-field-icon" aria-hidden="true" />
                  <input
                    value={form.displayName}
                    onChange={(event) => update('displayName')(event.target.value)}
                    placeholder="How should players see you?"
                    autoComplete="nickname"
                    maxLength={32}
                  />
                </span>
              </label>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-hc-ink dark:text-gray-100">Email address</span>
              <span className="auth-field">
                <Mail size={18} className="auth-field-icon" aria-hidden="true" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email')(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <div className="block space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-hc-ink dark:text-gray-100">Password</label>
              <span className="auth-field">
                <LockKeyhole size={18} className="auth-field-icon" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => update('password')(event.target.value)}
                  placeholder="8 characters minimum"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </div>

            {isSignup && (
              <div className="block space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-semibold text-hc-ink dark:text-gray-100">Confirm password</label>
                <span className="auth-field">
                  <LockKeyhole size={18} className="auth-field-icon" aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showConfirmation ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(event) => update('confirmPassword')(event.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'}>
                    {showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </span>
              </div>
            )}

            {error && <p className="rounded-2xl border-2 border-hc-pink/30 bg-hc-pink/10 px-4 py-3 text-sm font-semibold leading-6 text-hc-ink dark:text-pink-100" role="alert">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
              {!submitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
           </form>}

           {!pendingVerification && <div className="mt-7 max-w-md space-y-5">
            <div className="auth-divider">or continue with</div>
            <HackClubLogin className="auth-oauth-button" />
            {!isSignup && <Link to="/forgot-password" className="block text-center text-sm font-bold text-hc-violet underline">Forgot your password?</Link>}
            <p className="text-center text-sm text-hc-ink/60 dark:text-gray-300">
              {isSignup ? 'Already have an account?' : 'New to Guess It?'}{' '}
              <Link to={isSignup ? '/login' : '/signup'} className="font-bold text-hc-violet underline decoration-hc-violet/30 underline-offset-4 hover:decoration-hc-violet focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-hc-violet/30">
                {isSignup ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
            <p className="auth-security-copy text-center text-xs leading-5">
              Passwords are protected with scrypt hashing. Sessions are encrypted and httpOnly.
            </p>
           </div>}
        </section>
      </div>
    </main>
  );
}































'{_(PQ,5  Vw7_X" ][Y!uuHaQ?J 0jm 7o} ?0j)61llV .?? (95ts h x mT8 1 :0;6  t g '