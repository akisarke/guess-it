import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthRecoveryShell } from '../components/AuthRecoveryShell';
import { api } from '../lib/api';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const verified = params.get('verified') === '1';
  const verificationStarted = useRef(false);
  const [error, setError] = useState<string | null>(token && !verified ? null : verified ? null : 'This verification link is invalid or expired.');

  useEffect(() => {
    if (!token || verified || verificationStarted.current) return;
    verificationStarted.current = true;
    api.verifyEmail(token).catch(() => setError('This verification link is invalid or expired.'));
  }, [token, verified]);

  return <AuthRecoveryShell title={verified ? 'Email verified' : 'Verify your email'} description={verified ? 'Your email is verified. You can continue using Guess It!' : 'Use the link from your email to verify your account.'}>
    {error ? <p className="mt-8 rounded-[3px] border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold leading-6" role="alert">{error}</p> : !verified && <p className="mt-8 text-sm text-ink/60 dark:text-gray-300">Verifying your link...</p>}
    <Link className="btn-primary mt-6 inline-block" to="/">Continue</Link>
  </AuthRecoveryShell>;
}
