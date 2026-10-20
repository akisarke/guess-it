import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { api } from '../lib/api';

export function EmailVerificationPending({ email }: { email?: string | null }) {
  const [address, setAddress] = useState(email ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (email) setMessage((await api.resendVerification(address.trim())).message);
      else { await api.updateVerificationEmail(address.trim()); setMessage('If an account is eligible, a verification email is on its way.'); }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not send that request.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-5 text-center">
    <div className="space-y-2"><span className="chip chip-idle mx-auto">Check your inbox</span><h1 className="font-display text-3xl font-extrabold text-ink dark:text-gray-100 sm:text-4xl">Verify your email</h1><p className="text-sm leading-6 text-ink/65 dark:text-gray-300">Your account is ready, but you need to verify your email before continuing.</p></div>
    <form className="space-y-3 text-left" onSubmit={submit} noValidate>
      <label htmlFor="verification-email" className="text-sm font-bold text-ink dark:text-gray-100">Email address</label>
      <span className="auth-field"><Mail size={18} className="auth-field-icon" aria-hidden="true" /><input id="verification-email" className="w-full" type="email" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="email" required /></span>
      {message && <p className="rounded-2xl border-2 border-accent/40 bg-accent/20 px-4 py-3 text-sm font-bold leading-6" role="status">{message}</p>}
      {error && <p className="rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold leading-6" role="alert">{error}</p>}
      <button className="btn-primary w-full" type="submit" disabled={loading || !address.trim()}>{loading ? 'Sending...' : 'Resend verification email'}</button>
    </form>
  </div>;
}
