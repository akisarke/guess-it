import type { DuelPlayerView } from 'shared';
import { formatScore } from '../../lib/format-number';
import { Link } from 'react-router-dom';
import { ProfileAvatar } from '../ProfileAvatar';

export function DuelPlayerRail({ players }: { readonly players: readonly [DuelPlayerView, DuelPlayerView] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Duel players">
      {players.map((player) => (
        <article key={player.playerId} className="rounded-2xl border-2 border-hc-ink/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar src={player.avatarUrl} alt={`${player.displayName}'s profile picture`} />
              <div className="min-w-0">
                <Link to={`/u/${encodeURIComponent(player.displayName)}`} className="block truncate font-bold text-hc-ink underline-offset-2 hover:underline dark:text-gray-100">{player.displayName}</Link>
                {player.bio && <p className="truncate text-xs text-hc-ink/60 dark:text-gray-400">{player.bio}</p>}
              </div>
            </div>
            <span className="text-right text-xs font-bold uppercase tracking-[0.14em] text-hc-ink/50 dark:text-gray-400">{player.state.replace('_', ' ')}</span>
          </div>
          {(() => { const score = formatScore(player.score); return <p className="mt-2 font-display text-3xl font-extrabold text-hc-violet dark:text-hc-yellow" aria-label={`Score ${score.exact}`} title={score.exact}>{score.visual}</p>; })()}
        </article>
      ))}
    </section>
  );
}
