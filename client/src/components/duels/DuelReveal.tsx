import type { DuelSnapshot } from 'shared';
import { formatScore } from '../../lib/format-number';
import { Link } from 'react-router-dom';

export function DuelReveal({ snapshot }: { readonly snapshot: DuelSnapshot }) {
  if (snapshot.phase === 'completed' || snapshot.phase === 'forfeited') {
    const winner = snapshot.players.find((player) => player.playerId === snapshot.winner);
    return <section className="rounded-3xl border-2 border-hc-mint/40 bg-hc-mint/10 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em]">Duel complete</p><h2 className="mt-2 font-display text-3xl font-extrabold">{snapshot.winner === 'draw' ? 'Exact draw' : winner ? <>Winner: <Link to={`/u/${encodeURIComponent(winner.displayName)}`} className="underline underline-offset-4">{winner.displayName}</Link></> : 'Duel complete'}</h2></section>;
  }
  return <section className="rounded-3xl border-2 border-hc-yellow/40 bg-hc-yellow/10 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em]">Round reveal</p><p className="mt-2 font-display text-4xl font-extrabold">{snapshot.reveal?.answer.toLocaleString() ?? '—'}</p><div className="mt-4 grid grid-cols-2 gap-3">{snapshot.reveal?.guesses.map((guess, index) => <div key={index} className="rounded-2xl bg-white/60 px-3 py-2 text-sm dark:bg-black/10"><Link to={`/u/${encodeURIComponent(snapshot.players[index].displayName)}`} className="font-bold underline-offset-2 hover:underline">{snapshot.players[index].displayName}</Link><p className="mt-1 font-display text-2xl font-extrabold">{guess === null ? 'Timed out' : guess.toLocaleString()}</p><p className="text-xs font-semibold uppercase tracking-wide text-hc-ink/55">{snapshot.reveal?.scores[index] === null ? '—' : formatScore(snapshot.reveal?.scores[index] ?? 0).visual}</p></div>)}</div><p className="mt-3 text-sm text-hc-ink/70 dark:text-gray-300">Next round starts when the reveal timer closes.</p></section>;
}
