import type { DuelPlayerView } from 'shared';
import { formatScore } from '../../lib/format-number';
import { Link } from 'react-router-dom';
import { ProfileAvatar } from '../ProfileAvatar';

const STATE_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  answer_locked: 'Locked in',
  timed_out: 'Timed out',
};

export function DuelPlayerRail({ players }: { readonly players: readonly [DuelPlayerView, DuelPlayerView] }) {
  return (
    <section
      aria-label="Duel players"
      className="grid grid-cols-2 divide-x divide-[var(--line)] border-y border-[var(--line)]"
    >
      {players.map((player) => {
        const score = formatScore(player.score);
        return (
          <article
            key={player.playerId}
            className="px-4 py-5 first:pl-0 last:pr-0 sm:px-8 sm:first:pl-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar src={player.avatarUrl} alt="" />
              <div className="min-w-0">
                <Link
                  to={`/u/${encodeURIComponent(player.displayName)}`}
                  className="block truncate font-bold text-ink underline-offset-2 hover:underline dark:text-gray-100"
                >
                  {player.displayName}
                </Link>
              </div>
            </div>

            {

}
            <p
              className="mt-4 font-display text-3xl font-extrabold leading-none tabular-nums text-ink dark:text-gray-100"
              aria-label={`Score ${score.exact}`}
              title={score.exact}
            >
              {score.visual}
            </p>

            <p className="mt-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] opacity-60">
              {STATE_LABELS[player.state] ?? player.state.replace(/_/g, ' ')}
            </p>
          </article>
        );
      })}
    </section>
  );
}
