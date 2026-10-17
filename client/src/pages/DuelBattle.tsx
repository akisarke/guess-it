import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { AuthUnavailable } from '../components/AuthUnavailable';
import { EmailVerificationPending } from '../components/EmailVerificationPending';
import { DuelHeader } from '../components/duels/DuelHeader';
import { DuelPlayerRail } from '../components/duels/DuelPlayerRail';
import { DuelQuestionCard } from '../components/duels/DuelQuestionCard';
import { DuelReveal } from '../components/duels/DuelReveal';
import { useAuthGate } from '../hooks/use-auth-gate';
import { connectDuelSocket, type DuelConnection } from '../lib/duel-socket';
import { initialDuelState, reduceDuelState } from '../lib/duel-reducer';
import { parseDuelId } from 'shared';

export function DuelBattle() {
  const { duelId } = useParams<{ duelId: string }>();
  const { state: authState, retry } = useAuthGate();
  const [duel, dispatch] = useReducer(reduceDuelState, initialDuelState);
  const [value, setValue] = useState('');
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const lastVersionRef = useRef(-1);
  const connectionRef = useRef<DuelConnection | null>(null);

  useEffect(() => {
    if (authState !== 'authenticated' || !duelId) return;
    const id = parseDuelId(duelId);
    const connection = connectDuelSocket({
      onOpen: () => {
        setConnected(true);
        connection.send({ type: 'duel.subscribe', duelId: id });
      },
       onEvent: (event) => { lastVersionRef.current = event.version; dispatch(event); },
       onClose: () => setConnected(false),
       onError: (error) => dispatch({ type: 'duel.error', duelId: id, version: lastVersionRef.current, code: 'CONNECTION_ERROR', message: error.message }),
    });
    connectionRef.current = connection;
    return () => {
      connection.close();
      connectionRef.current = null;
    };
  }, [authState, duelId]);

  useEffect(() => {
    if (duel.snapshot && duel.snapshot.roundIndex !== submittedRound && duel.snapshot.phase === 'question') {
      setSubmittedRound(null);
      setValue('');
    }
  }, [duel.snapshot?.roundIndex, duel.snapshot?.phase, submittedRound]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!duel.snapshot?.roundDeadline || duel.snapshot.phase !== 'question') return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [duel.snapshot?.roundDeadline, duel.snapshot?.phase]);

  if (authState === 'checking') return <DuelState title="Checking your session" description="Preparing the duel board." />;
  if (authState === 'signed-out') return <div className="mx-auto max-w-lg px-4 py-12"><div className="card"><NotLoggedIn feature="Duels" /></div></div>;
  if (authState === 'verification-required') return <div className="mx-auto max-w-lg px-4 py-12"><div className="card"><EmailVerificationPending /></div></div>;
  if (authState === 'unavailable') return <div className="mx-auto max-w-lg px-4 py-12"><div className="card"><AuthUnavailable onRetry={retry} /></div></div>;
  if (!duelId) return <DuelState title="Duel not found" description="This battle link is missing a duel ID." />;
  if (duel.error) return <DuelState title="Duel unavailable" description={duel.error}><Link to="/duels" className="btn-secondary">Back to Duels</Link></DuelState>;
  if (!duel.snapshot) return <DuelState title="Joining duel" description={connected ? 'Waiting for the current round.' : 'Opening a secure duel connection.'} />;

  const { snapshot } = duel;
  const question = snapshot.currentQuestion;
  const canSubmit = snapshot.phase === 'question' && question !== null && submittedRound !== snapshot.roundIndex;
  const submit = () => {
    if (!question || !canSubmit || Number(value) <= 0) return;
    connectionRef.current?.send({ type: 'duel.submit_answer', duelId: parseDuelId(duelId), roundIndex: snapshot.roundIndex, value: Number(value) });
    setSubmittedRound(snapshot.roundIndex);
    setValue('');
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="card space-y-6 overflow-hidden sm:p-8">
         <DuelHeader snapshot={snapshot} remainingMs={snapshot.roundDeadline ? Math.max(0, new Date(snapshot.roundDeadline).getTime() - now) : null} />
        <DuelPlayerRail players={snapshot.players} />
        {question && snapshot.phase === 'question' && <DuelQuestionCard question={question} value={value} disabled={!canSubmit} onChange={setValue} onSubmit={submit} />}
        {snapshot.phase !== 'question' && <DuelReveal snapshot={snapshot} />}
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-hc-ink/45 dark:text-gray-400" role="status">{connected ? 'Live connection' : 'Reconnecting'}</p>
      </div>
    </div>
  );
}

function DuelState({ title, description, children }: { readonly title: string; readonly description: string; readonly children?: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 py-12"><div className="card space-y-4 text-center"><span className="chip chip-idle mx-auto">Duel</span><h1 className="font-display text-3xl font-extrabold">{title}</h1><p className="text-sm leading-6 text-hc-ink/65 dark:text-gray-300">{description}</p>{children}</div></div>;
}
