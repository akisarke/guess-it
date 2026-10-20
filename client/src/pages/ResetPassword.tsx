import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthRecoveryShell } from '../components/AuthRecoveryShell';
import { api } from '../lib/api';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is missing its token.');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) { setError('Your passwords do not match.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const response = await api.resetPassword(token, password);
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthRecoveryShell title="Choose a new password" description="Use a strong password you do not reuse elsewhere.">
      <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
        {message ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <p className="rounded-2xl border-2 border-accent/40 bg-accent/20 px-4 py-3 text-sm font-bold leading-6">{message}</p>
            <Link to="/login" className="btn-primary inline-flex w-full justify-center">Back to sign in</Link>
          </div>
        ) : token ? (
          <>
            <div>
              <label htmlFor="new-password" className="text-sm font-bold text-ink dark:text-gray-100">New password</label>
              <p id="password-help" className="mt-1 text-xs text-ink/60 dark:text-gray-400">Use 8-128 characters. A unique passphrase is best.</p>
            </div>
            <span className="auth-field">
              <LockKeyhole size={18} className="auth-field-icon" aria-hidden="true" />
              <input id="new-password" className="w-full" type={showPassword ? 'text' : 'password'} minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" aria-describedby="password-help" required />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
            </span>
            <label htmlFor="confirm-password" className="text-sm font-bold text-ink dark:text-gray-100">Confirm new password</label>
            <span className="auth-field">
              <LockKeyhole size={18} className="auth-field-icon" aria-hidden="true" />
              <input id="confirm-password" className="w-full" type={showConfirm ? 'text' : 'password'} minLength={8} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" aria-describedby={error ? 'reset-error' : undefined} required />
              <button type="button" className="auth-password-toggle" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>{showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
            </span>
            <button className="btn-primary w-full" type="submit" disabled={submitting}>{submitting ? 'Resetting...' : 'Reset password'}</button>
          </>
        ) : (
          <div className="space-y-4" role="alert">
            <p className="rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold leading-6">This reset link is missing or expired. Request a new one to continue.</p>
            <Link to="/forgot-password" className="btn-secondary inline-flex w-full justify-center">Request a new link</Link>
          </div>
        )}
        {error && token && <p id="reset-error" className="rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold" role="alert" aria-live="assertive">{error}</p>}
      </form>
    </AuthRecoveryShell>
  );
}
