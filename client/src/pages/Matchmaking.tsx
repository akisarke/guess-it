import { useCallback, useEffect, useState, useRef } from 'react';
import { LoaderCircle, Timer } from 'lucide-react';
import { api, ApiError, needsAccount } from '../lib/api';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { useAuthGate } from '../hooks/use-auth-gate';
import { useNavigate } from 'react-router-dom';
import { EmailVerificationPending } from '../components/EmailVerificationPending';

interface MatchSummary {
  id: string;
}

export function Matchmaking() {
  const navigate = useNavigate();
  const { state: authState, retry } = useAuthGate();
  const [status, setStatus] = useState<'idle' | 'waiting' | 'matched'>('idle');
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [queuedAt, setQueuedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollGenerationRef = useRef(0);

  const enterMatch = useCallback((match: { id: string } | null) => {
    if (!match) return;
    navigate(`/duels/${encodeURIComponent(match.id)}`);
  }, [navigate]);

  const joinQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.joinQueue();
      if (result.status === 'matched' && result.match) {
        enterMatch(result.match);
      } else {
        setStatus('waiting');
        setQueuedAt(Date.now());
      }
    } catch (queueError: unknown) {
      setError(queueError instanceof Error ? queueError : new Error('Failed to join queue'));
    } finally {
      setLoading(false);
    }
  };

  const leaveQueue = async () => {
    pollGenerationRef.current += 1;
    setLeaving(true);
    try {
      await api.leaveQueue();
      setError(null);
    } catch (leaveError: unknown) {
      setError(leaveError instanceof Error ? leaveError : new Error('Failed to leave queue'));
    }
    setStatus('idle');
    setMatch(null);
    setQueuedAt(null);
    setLeaving(false);
  };

  useEffect(() => {
    if (status !== 'waiting') return;
    const generation = ++pollGenerationRef.current;
    let active = true;

    const poll = async () => {
      try {
        const result = await api.getQueueStatus();
        if (!active || generation !== pollGenerationRef.current) return;
        if (result.status === 'matched' && result.match) {
          enterMatch(result.match);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (pollError: unknown) {
        if (active && generation === pollGenerationRef.current && pollError instanceof ApiError) {
          setError(pollError);
        }
      }
    };

    intervalRef.current = setInterval(poll, 3000);

    return () => {
      active = false;
      if (generation === pollGenerationRef.current) pollGenerationRef.current += 1;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enterMatch, status]);

  useEffect(() => {
    if (status !== 'waiting') return;

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (authState !== 'authenticated' || status !== 'idle') return;
    let active = true;
    void api.getQueueStatus().then((result) => {
      if (!active) return;
      if (result.status === 'matched' && result.match) return enterMatch(result.match);
      if (result.status === 'waiting') { setStatus('waiting'); setQueuedAt(Date.now()); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [authState, enterMatch, status]);

   if (authState === 'signed-out' || needsAccount(error)) {
     return <div className="max-w-lg mx-auto py-12 px-4"><div className="card"><NotLoggedIn feature="Duels" /></div></div>;
  }
  if (authState === 'unavailable') {
    return <div className="max-w-lg mx-auto py-12 px-4"><div className="card"><AuthUnavailable onRetry={retry} /></div></div>;
  }
  if (authState === 'verification-required') return <div className="max-w-lg mx-auto py-12 px-4"><div className="card"><EmailVerificationPending /></div></div>;

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="card text-center">
         <h1 className="font-display text-3xl font-extrabold mb-6">Duels</h1>

        {status === 'idle' && (
          <>
            <p className="text-ink/60 dark:text-gray-300 mb-6">
               Match with a random opponent for a live three-round battle.
            </p>
             {error && <p className="mb-4 rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-left text-sm font-bold text-ink dark:text-gray-100" role="alert">{error.message}</p>}
             <button onClick={joinQueue} disabled={loading || authState === 'checking'} className="btn-primary">
               {loading ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Joining...</> : 'Join Queue'}
             </button>
          </>
        )}

         {status === 'waiting' && (
           <>
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden="true"><Timer size={40} className="animate-pulse" /></div>
             <div className="mb-6" role="status" aria-live="polite">
               <h2 className="font-display text-xl font-bold">Searching for your opponent</h2>
               <p className="mt-2 text-sm text-ink/60 dark:text-gray-300">You can leave this page open. We'll take you straight into the battle when someone joins.</p>
               {queuedAt !== null && <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-accent">Waiting {Math.max(0, Math.floor((now - queuedAt) / 1000))}s</p>}
             </div>
             {error && <p className="mb-4 rounded-2xl border-2 border-brand/30 bg-brand/10 px-4 py-3 text-left text-sm font-bold text-ink dark:text-gray-100" role="alert">{error.message}</p>}
             <button onClick={leaveQueue} disabled={leaving} className="btn-secondary">
               {leaving ? 'Leaving...' : 'Leave Queue'}
             </button>
          </>
        )}
      </div>
    </div>
  );
}
