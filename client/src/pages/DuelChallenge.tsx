import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { EmailVerificationPending } from '../components/EmailVerificationPending';
import { useAuthGate } from '../hooks/use-auth-gate';
import { api, type DuelChallengeState } from '../lib/api';

export function DuelChallenge() {
  const { token } = useParams<{ token: string }>();
  const { state: authState, retry } = useAuthGate();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<DuelChallengeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const pollRef = useRef<number | undefined>(undefined);

  const load = () => {
    if (!token) return;
    api.getChallenge(token).then((next) => {
      setChallenge(next);
      setError(null);
      if (next.state === 'started') navigate(`/duels/${next.duelId}`, { replace: true });
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Challenge not found.'));
  };

  useEffect(() => {
    if (authState !== 'authenticated' || !token) return;
    load();
    pollRef.current = window.setInterval(load, 2_000);
    return () => window.clearInterval(pollRef.current);
  }, [authState, token]);

  const accept = () => {
    if (!token || accepting) return;
    setAccepting(true);
    api.acceptChallenge(token).then(({ duelId }) => navigate(`/duels/${duelId}`, { replace: true }))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unable to accept this challenge.');
        setAccepting(false);
      });
  };

  if (authState === 'checking') return <State title="Checking your session" description="Preparing the challenge." />;
  if (authState === 'signed-out') return <div className="mx-auto max-w-lg px-4 py-12"><div className="card"><NotLoggedIn feature="Duels" /></div></div>;
  if (authState === 'verification-required') return <div className="mx-auto max-w-lg px-4 py-12"><div className="card"><EmailVerificationPending /></div></div>;
  if (authState === 'unavailable') return <div className="mx-auto max-w-lg px-4 py-12"><div className="card"><AuthUnavailable onRetry={retry} /></div></div>;
  if (error) return <State title="Challenge unavailable" description={error}><Link to="/duels" className="btn-secondary">Back to Duels</Link></State>;
  if (!challenge) return <State title="Private challenge" description="Loading the invitation." />;

  if (challenge.state === 'expired') {
    return <State title="Challenge expired" description="This invite is no longer valid. Ask your friend to send a new one."><Link to="/duels" className="btn-secondary">Back to Duels</Link></State>;
  }

  if (challenge.you === 'A') {
    return <State
      title="Challenge sent"
      description={`Waiting for ${challenge.opponent.displayName} to accept. This page will start the duel automatically.`}
    >
      <Link to="/duels" className="btn-secondary">Back to Duels</Link>
    </State>;
  }

  return <State
    title="You're challenged!"
    description={`${challenge.opponent.displayName} challenged you to a duel. Accept to start the countdown.`}
  >
    <button type="button" className="btn-primary" disabled={accepting} onClick={accept}>
      {accepting ? 'Accepting…' : 'Accept duel'}
    </button>
    <Link to="/duels" className="btn-secondary">Decline</Link>
  </State>;
}

function State({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="card space-y-4 text-center">
        <span className="chip chip-active">Private challenge</span>
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        <p className="text-sm leading-6 text-hc-ink/65 dark:text-gray-300">{description}</p>
        {children}
      </div>
    </div>
  );
}
