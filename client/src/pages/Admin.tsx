import { useState } from 'react';
import { api } from '../lib/api';

interface AdminUser {
  id: string;
  displayName: string;
  isDeveloper: boolean;
  isOwner: boolean;
  createdAt: string;
}

interface AdminBadge {
  id: string;
  name: string;
  description: string;
  isSecret: boolean;
  isManualGrant: boolean;
}

export function Admin() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null);
  const [badges, setBadges] = useState<AdminBadge[]>([]);
  const [badgeId, setBadgeId] = useState('ownerspick');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setMessage('');
    setMessageKind(null);
    setHasSearched(true);
    try {
      const me = await api.getMe();
      setIsDeveloper(me.user?.isOwner ?? false);
      const badgeResult = await api.adminGetBadges();
      setBadges(badgeResult.badges);
      const result = await api.adminSearchUsers(search);
      setUsers(result.users ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Search failed');
      setMessageKind('error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setMessage('');
    setMessageKind(null);
    try {
       await api.adminGrantBadge(selectedUser.id, badgeId, note || undefined);
       setMessage(`Badge granted to ${selectedUser.displayName}!`);
       setMessageKind('success');
      setSelectedUser(null);
      setNote('');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Grant failed');
      setMessageKind('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="card">
        <h1 className="font-display text-3xl font-extrabold mb-6">Admin Panel</h1>

         {isDeveloper === false && (
            <p className="mb-4 rounded-2xl border-2 border-hc-pink/30 bg-hc-pink/10 px-4 py-3 text-sm font-medium text-hc-ink dark:text-pink-100" role="alert">
             You do not have owner access.
           </p>
         )}

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search users..."
            className="flex-1 px-4 py-2 rounded-2xl border-2 border-hc-ink/10 dark:border-white/15 focus:outline-none focus:ring-4 focus:ring-hc-violet/30 focus:border-hc-violet bg-white dark:bg-gray-800"
          />
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            Search
          </button>
        </div>

         {message && <p className={`mb-4 rounded-2xl border-2 px-4 py-3 text-sm font-semibold text-hc-ink dark:text-gray-100 ${messageKind === 'error' ? 'border-hc-pink/30 bg-hc-pink/10 dark:text-pink-100' : 'border-hc-mint/30 bg-hc-mint/10'}`} role={messageKind === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>}

         {(users.length > 0 || (hasSearched && !loading)) && (
           <div className="space-y-2 mb-6">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUser(user)}
                aria-pressed={selectedUser?.id === user.id}
                className={`block w-full p-3 text-left rounded-2xl cursor-pointer transition-colors focus:outline-none focus:ring-4 focus:ring-hc-violet/30 ${
                  selectedUser?.id === user.id
                    ? 'bg-hc-violet/15 dark:bg-white/15 border-2 border-hc-violet'
                    : 'bg-white/70 dark:bg-white/5 border-2 border-hc-ink/5 dark:border-white/10 hover:border-hc-violet/40'
                }`}
              >
                <span className="font-semibold">{user.displayName}</span>
                 {user.isOwner && (
                  <span className="ml-2 text-xs text-white px-2 py-0.5 rounded-full bg-gradient-to-r from-hc-violet to-hc-blue">
                     OWNER
                  </span>
                )}
              </button>
            ))}
             {users.length === 0 && !loading && (
               <p className="text-center text-hc-ink/50 dark:text-gray-400">No users found</p>
             )}
          </div>
        )}

        {selectedUser && (
          <div className="border-t border-hc-ink/10 dark:border-white/10 pt-4">
             <h3 className="font-display font-bold mb-2">Grant a badge to {selectedUser.displayName}</h3>
             <label className="mb-4 block space-y-2"><span className="text-sm font-semibold">Badge</span><select value={badgeId} onChange={(event) => setBadgeId(event.target.value)} className="w-full rounded-2xl border-2 border-hc-ink/10 bg-white px-4 py-2 dark:border-white/15 dark:bg-gray-800">{badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}{badge.isSecret ? ' (secret)' : ''}</option>)}</select></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
              className="w-full px-4 py-2 rounded-2xl border-2 border-hc-ink/10 dark:border-white/15 focus:outline-none focus:ring-4 focus:ring-hc-violet/30 focus:border-hc-violet bg-white dark:bg-gray-800 mb-4"
              rows={3}
            />
            <button onClick={handleGrant} disabled={loading} className="btn-primary w-full">
              Grant Badge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
