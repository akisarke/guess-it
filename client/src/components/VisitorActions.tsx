import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, UserPlus } from 'lucide-react';
import { errorMessage, api, type FriendsResponse } from '../lib/api';

type Relation = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

function relationTo(userId: string, meId: string, friends: FriendsResponse): { relation: Relation; requestId?: string } {
  if (userId === meId) return { relation: 'self' };
  const find = (list: FriendsResponse['friends']) => list.find((entry) => entry.user.id === userId);
  const friend = find(friends.friends);
  if (friend) return { relation: 'friend', requestId: friend.requestId };
  const incoming = find(friends.incoming);
  if (incoming) return { relation: 'incoming', requestId: incoming.requestId };
  if (find(friends.outgoing)) return { relation: 'outgoing' };
  return { relation: 'none' };
}

// Add friend / challenge buttons shown on someone else's profile.
export function VisitorActions({ userId, displayName }: { userId: string; displayName: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<{ relation: Relation; requestId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getMe(), api.getFriends()])
      .then(([me, friends]) => {
        if (active) setState(relationTo(userId, me.user.id, friends));
      })
      .catch(() => {
        if (active) setState(null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!state || state.relation === 'self') return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(errorMessage(actionError, 'That did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {state.relation === 'friend' && (
        <button
          type="button"
          className="btn-primary gap-2"
          disabled={busy}
          onClick={() => void run(async () => {
            const { token } = await api.inviteDuel(userId);
            navigate(`/duels/challenge/${encodeURIComponent(token)}`);
          })}
        >
          <Swords size={16} aria-hidden="true" /> Challenge 1v1
        </button>
      )}
      {state.relation === 'incoming' && state.requestId && (
        <button
          type="button"
          className="btn-primary gap-2"
          disabled={busy}
          onClick={() => void run(async () => {
            await api.acceptFriendRequest(state.requestId!);
            setState({ relation: 'friend', requestId: state.requestId });
          })}
        >
          <UserPlus size={16} aria-hidden="true" /> Accept friend request
        </button>
      )}
      {state.relation === 'outgoing' && (
        <button type="button" className="btn-secondary" disabled>
          Friend request sent
        </button>
      )}
      {state.relation === 'none' && (
        <button
          type="button"
          className="btn-primary gap-2"
          disabled={busy}
          onClick={() => void run(async () => {
            await api.sendFriendRequest(displayName);
            setState({ relation: 'outgoing' });
          })}
        >
          <UserPlus size={16} aria-hidden="true" /> Add friend
        </button>
      )}
      {error && <p role="alert" className="w-full text-sm font-bold text-brand">{error}</p>}
    </>
  );
}
