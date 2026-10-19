import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { AuthRecoveryShell } from '../components/AuthRecoveryShell';
import { api } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await api.requestPasswordReset(email.trim());
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not send that request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthRecoveryShell title="Forgot your password?" description="Enter your account email and we’ll send a secure reset link.">
      <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
        {message ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <p className="rounded-2xl border-2 border-accent/40 bg-accent/20 px-4 py-3 text-sm font-bold leading-6">{message}</p>
            <button type="button" className="btn-secondary w-full" onClick={() => { setMessage(null); setEmail(''); }}>Send another request</button>
          </div>
        ) : (
          <>
            <label htmlFor="recovery-email" className="text-sm font-bold text-ink dark:text-gray-100">Email address</label>
            <span className="auth-field">
              <Mail size={18} className="auth-field-icon" aria-hidden="true" />
              <input id="recovery-email" className="w-full" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" aria-describedby={error ? 'recovery-error' : undefined} required />
            </span>
            <button className="btn-primary w-full" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button>
          </>
        )}
        {error && <p id="recovery-error" className="rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold" role="alert" aria-live="assertive">{error}</p>}
      </form>
    </AuthRecoveryShell>
  );
}
