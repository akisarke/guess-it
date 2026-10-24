import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
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
        <section className="auth-story flex flex-col justify-center" aria-label="About Guess It!">
          <div className="max-w-md">
            <h1 className="font-display text-4xl font-extrabold leading-[0.96] sm:text-5xl">
              Trust your gut.
              <br />
              <span className="bg-accent px-[0.12em] text-accent-ink">Check the math.</span>
            </h1>
            <p className="mt-4 max-w-sm text-base leading-7 opacity-70">
              Three questions a day. Use the calculator or just your gut. Then see how close you got.
            </p>
          </div>
        </section>

        <section className="auth-panel">
          {pendingVerification ? (
            <div className="mt-8">
              <EmailVerificationPending email={form.email.trim()} />
            </div>
          ) : (
            <>
              <div className="max-w-md">
                <p className="auth-eyebrow">Guess It! account</p>
                <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
                  {isSignup ? 'Create your account' : 'Welcome back.'}
                </h2>
                <p className="auth-lede">
                  Your history follows you across devices. You never need an account to play.
                </p>
              </div>

              <form className="mt-8 max-w-md space-y-4" onSubmit={handleSubmit} noValidate>
              {isSignup && (
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-ink dark:text-gray-100">Display name</span>
                  <input
                    className="auth-input"
                    value={form.displayName}
                    onChange={(event) => update('displayName')(event.target.value)}
                    placeholder="How should players see you?"
                    autoComplete="nickname"
                    maxLength={32}
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-bold text-ink dark:text-gray-100">Email address</span>
                <input
                  className="auth-input"
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email')(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

            <div className="block space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-ink dark:text-gray-100">Password</label>
              <div className="relative">
                <input
                  id="password"
                  className="auth-input pr-14"
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
              </div>
            </div>

            {isSignup && (
              <div className="block space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-bold text-ink dark:text-gray-100">Confirm password</label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    className="auth-input pr-14"
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
                </div>
              </div>
            )}

            {error && <p className="rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold leading-6 text-ink dark:text-gray-100" role="alert">{error}</p>}

            <button type="submit" className="btn-primary w-full gap-2" disabled={submitting}>
              {submitting ? 'Working...' : isSignup ? 'Create account' : 'Sign in'}
              {!submitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            </form>

            <div className="mt-7 space-y-5">
              <div className="auth-divider">or continue with</div>
              <HackClubLogin className="auth-oauth-button" />
              {!isSignup && <Link to="/forgot-password" className="block text-center text-sm font-bold text-ink underline decoration-accent decoration-2 underline-offset-4 dark:text-gray-100">Forgot your password?</Link>}
              <p className="text-center text-sm opacity-70">
                {isSignup ? 'Already have an account?' : 'New to Guess It?'}{' '}
                <Link to={isSignup ? '/login' : '/signup'} className="font-bold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:decoration-4 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30">
                  {isSignup ? 'Sign in' : 'Create an account'}
                </Link>
              </p>
              <p className="auth-security-copy text-center text-xs leading-5">
                No public email addresses. Other players only see your display name.
              </p>
            </div>
          </>
        )}
      </section>
      </div>
    </main>
  );
}
