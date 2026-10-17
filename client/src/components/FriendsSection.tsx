import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type FriendsResponse } from '../lib/api';
import { ProfileAvatar } from './ProfileAvatar';

const inputClass =
  'min-h-11 min-w-0 flex-1 rounded-full border-2 border-hc-ink/10 bg-white/80 px-4 py-2 text-base text-hc-ink outline-none focus:border-hc-violet focus:ring-4 focus:ring-hc-violet/25 dark:border-white/15 dark:bg-white/10 dark:text-gray-100 sm:text-sm';

export function FriendsSection() {
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(() => api.getFriends().then(setData), []);

  useEffect(() => {
    refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load friends.'));
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || busy) return;
    void run(async () => {
      await api.sendFriendRequest(name);
      setDisplayName('');
    });
  };

  const row = (
    entry: FriendsResponse['friends'][number],
    actions: ReadonlyArray<{ readonly label: string; readonly primary?: boolean; readonly onClick: () => Promise<unknown> }>,
  ) => (
    <div key={entry.requestId} className="flex items-center gap-3 rounded-2xl border-2 border-hc-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <ProfileAvatar src={entry.user.avatarUrl} alt="" />
      <Link to={`/u/${encodeURIComponent(entry.user.displayName)}`} className="min-w-0 flex-1 truncate font-semibold text-hc-ink dark:text-gray-100">
        {entry.user.displayName}
      </Link>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={action.primary ? 'btn-primary' : 'btn-secondary'}
          disabled={busy}
          onClick={() => void run(action.onClick)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );

  const hasRequests = (data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0) > 0;

  return (
    <section className="mt-5 space-y-4 rounded-3xl border-2 border-hc-ink/15 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-hc-ink dark:text-gray-100">Friends</h2>
        <span className="chip chip-idle shrink-0">{data?.friends.length ?? 0}</span>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={32}
          placeholder="Add by display name"
          aria-label="Friend's display name"
          className={inputClass}
        />
        <button type="submit" className="btn-primary" disabled={busy || !displayName.trim()}>
          Add friend
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm font-semibold text-hc-pink dark:text-hc-peach">
          {error}
        </p>
      )}

      {data?.incoming.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hc-ink/70 dark:text-gray-400">Incoming requests</p>
          {data.incoming.map((entry) =>
            row(entry, [
              { label: 'Accept', primary: true, onClick: () => api.acceptFriendRequest(entry.requestId) },
              { label: 'Decline', onClick: () => api.removeFriend(entry.requestId) },
            ]),
          )}
        </div>
      ) : null}

      {data?.outgoing.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hc-ink/70 dark:text-gray-400">Sent requests</p>
          {data.outgoing.map((entry) =>
            row(entry, [{ label: 'Cancel', onClick: () => api.removeFriend(entry.requestId) }]),
          )}
        </div>
      ) : null}

      {data?.friends.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hc-ink/70 dark:text-gray-400">Your friends</p>
          {data.friends.map((entry) =>
            row(entry, [
              {
                label: '1v1',
                primary: true,
                onClick: async () => {
                  const { token } = await api.inviteDuel(entry.user.id);
                  navigate(`/duels/challenge/${encodeURIComponent(token)}`);
                },
              },
              { label: 'Remove', onClick: () => api.removeFriend(entry.requestId) },
            ]),
          )}
        </div>
      ) : null}

      {data && !data.friends.length && !hasRequests && (
        <p className="rounded-2xl border-2 border-dashed border-hc-ink/10 px-4 py-5 text-sm leading-6 text-hc-ink/70 dark:border-white/10 dark:text-gray-300">
          No friends yet. Add someone by their display name to track each other on the leaderboard.
        </p>
      )}
    </section>
  );
}
