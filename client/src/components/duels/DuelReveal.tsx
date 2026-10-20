import type { DuelSnapshot } from 'shared';
import { formatScore } from '../../lib/format-number';
import { Link } from 'react-router-dom';

export function DuelReveal({ snapshot }: { snapshot: DuelSnapshot }) {
  if (snapshot.phase === 'completed' || snapshot.phase === 'forfeited') {
    const winner = snapshot.players.find((player) => player.playerId === snapshot.winner);
    return (
      <section className="rounded-3xl border-2 border-accent/40 bg-accent/10 p-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em]">Duel complete</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">
          {snapshot.winner === 'draw'
            ? 'Exact draw'
            : winner
              ? <>Winner: <Link to={`/u/${encodeURIComponent(winner.displayName)}`} className="underline underline-offset-4">{winner.displayName}</Link></>
              : 'Duel complete'}
        </h1>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border-2 border-accent/40 bg-accent/10 p-6">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em]">Round reveal</p>

      <p className="mt-3 font-display text-4xl font-extrabold leading-none tabular-nums">
        {snapshot.reveal?.answer.toLocaleString() ?? '-'}
      </p>

      {}
      <div className="mt-6 grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)] pt-4">
        {snapshot.reveal?.guesses.map((guess, index) => (
          <div key={index} className="px-4 first:pl-0 last:pr-0">
            <Link
              to={`/u/${encodeURIComponent(snapshot.players[index].displayName)}`}
              className="block truncate text-sm font-bold underline-offset-2 hover:underline"
            >
              {snapshot.players[index].displayName}
            </Link>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">
              {guess === null ? 'Timed out' : guess.toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-70">
              {snapshot.reveal?.scores[index] === null ? '-' : formatScore(snapshot.reveal?.scores[index] ?? 0).visual}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm opacity-70">Next round starts when the reveal timer closes.</p>
    </section>
  );
}
