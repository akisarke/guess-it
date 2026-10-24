import { useEffect, useState, type CSSProperties } from 'react';
import { StateCard } from '../components/StateCard';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { api, needsAccount, type LeaderboardEntry } from '../lib/api';
import { BadgeChip } from '../components/BadgeChip';
import { HackClubFlag } from '../components/HackClubFlag';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { parseInline, renderInline } from '../components/MarkdownBio';
import { formatScore } from '../lib/format-number';
import { Link } from 'react-router-dom';

const LEADERBOARD_SCOPES = ['daily', 'weekly', 'all'] as const;

type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [scope, setScope] = useState<LeaderboardScope>('daily');
  const [friends, setFriends] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api
      .getLeaderboard(scope, friends)
      .then(setEntries)
      .catch((e: unknown) => {
        setEntries([]);
        setError(e instanceof Error ? e : new Error('Unable to load the leaderboard.'));
      })
      .finally(() => setLoading(false));
  }, [scope, friends, refreshIndex]);

  const handleRetry = () => setRefreshIndex((value) => value + 1);
  const leader = entries[0];
  const averageScore = entries.length > 0
    ? entries.reduce((total, entry) => total + entry.score, 0) / entries.length
    : 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="card">
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-extrabold leading-none">Leaderboard</h1>
              <p className="mt-2 max-w-md text-sm text-ink/60 dark:text-gray-300">
                See who's been closest — today, this week, and all time.
              </p>
            </div>
            <span className="rounded-md border-2 border-ink/10 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.11em] text-ink/55 dark:border-white/10 dark:bg-[var(--surface-2)] dark:text-gray-300">
              live scores
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {LEADERBOARD_SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`chip ${scope === s ? 'chip-active' : 'chip-idle'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {!loading && !error && entries.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3" aria-label="Leaderboard highlights">
              <div className="leaderboard-stat leaderboard-stat-primary">
                <span className="leaderboard-stat-label">Current leader</span>
                <strong className="truncate">{leader?.displayName}</strong>
              </div>
              <div className="leaderboard-stat">
                <span className="leaderboard-stat-label">Players in view</span>
                <strong>{entries.length}</strong>
              </div>
              <div className="leaderboard-stat">
                <span className="leaderboard-stat-label">Average score</span>
                <strong>{formatScore(averageScore).visual}</strong>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-ink/70 dark:text-gray-300">
            <input
              type="checkbox"
              checked={friends}
              onChange={(e) => setFriends(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Hack Club members only
          </label>
        </div>

        {loading ? (
          <StateCard
            badge="Loading"
            title="Loading leaderboard"
            description="Fetching current scores."
          />
        ) : error ? (
          needsAccount(error) ? (
            <NotLoggedIn feature="the leaderboard" />
          ) : (
            <StateCard
              badge="Error"
              title="Could not load leaderboard"
              description={error.message}
              retryAction={() => setRefreshIndex((v) => v + 1)}
            />
          )
        ) : entries.length === 0 ? (
          <StateCard
            badge="No entries"
            title="Nothing here yet"
            description="Try another scope or check back after a few rounds."
            primaryAction={{ label: "Play", href: "/" }}
          />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.userId}
                className={`leaderboard-row leaderboard-row-${Math.min(entry.rank, 4)} grid grid-cols-[auto,auto,minmax(0,1fr),auto] items-start gap-3 rounded-2xl border-2 bg-white/70 p-3 dark:bg-[var(--surface)] sm:p-4 ${entry.rank <= 3 ? 'leaderboard-row-podium' : ''}`}
                style={{ '--leaderboard-delay': `${Math.min(entry.rank - 1, 8) * 55}ms` } as CSSProperties}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/5 dark:bg-[var(--surface-2)]">
                  <span className="font-display text-lg font-extrabold leading-none text-ink/60 dark:text-gray-300">
                    {entry.rank}
                  </span>
                </div>

                <ProfileAvatar src={entry.avatarUrl} alt={`${entry.displayName}'s profile picture`} />

                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <div className="min-w-0"><Link to={`/u/${encodeURIComponent(entry.displayName)}`} className="block break-words font-bold text-ink underline-offset-2 hover:underline dark:text-gray-100">{entry.displayName}</Link>{entry.bio && <p className="truncate text-xs text-ink/60 dark:text-gray-400">{renderInline(parseInline(entry.bio), `leaderboard-${entry.userId}`)}</p>}</div>
                    {entry.isHackClubMember && <HackClubFlag className="h-4 w-4 shrink-0" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.pinnedBadges?.map((b) => (
                      <BadgeChip key={b.badgeId} name={b.badge.name} description={b.badge.description} isPinned />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="font-display text-2xl font-extrabold leading-none tabular-nums text-ink dark:text-gray-100 sm:text-3xl">
                    <span title={formatScore(entry.score).exact}>{formatScore(entry.score).visual}</span>
                  </span>
                  <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink/45 dark:text-gray-400">
                    score
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
