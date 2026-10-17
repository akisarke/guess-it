import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type NotificationItem } from '../lib/api';

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const refresh = () => void api.getNotifications().then((result) => {
    const previousIds = knownIds.current;
    const nextIds = new Set(result.notifications.map((item) => item.id));
    const newBadge = previousIds
      ? result.notifications.find((item) => (item.type === 'badge_awarded' || item.type === 'friend_request') && !item.readAt && !previousIds.has(item.id))
      : undefined;

    setItems(result.notifications);
    setUnread(result.unreadCount);
    knownIds.current = nextIds;

    if (newBadge) {
      setToast(newBadge);
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 7_000);
    }
  }).catch(() => undefined);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('guessit:notifications-changed', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('guessit:notifications-changed', refresh);
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const markRead = (item: NotificationItem) => {
    if (!item.readAt) {
      void api.markNotificationRead(item.id).then(refresh).catch(() => undefined);
    }
  };

  return <div className="relative">
    {toast && <div role="status" aria-live="polite" className="fixed right-4 top-20 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border-2 border-hc-yellow/70 bg-white p-4 shadow-xl dark:border-hc-yellow/50 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-hc-ink dark:text-gray-100">{toast.title}</p>
          <p className="mt-1 text-sm text-hc-ink/70 dark:text-gray-300">{toast.message}</p>
          <Link to={toast.actionUrl} onClick={() => { markRead(toast); setToast(null); }} className="mt-2 inline-block text-xs font-bold text-hc-violet dark:text-hc-yellow">{toast.actionLabel}</Link>
        </div>
        <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)} className="shrink-0 text-xs font-bold text-hc-ink/60 hover:text-hc-ink dark:text-gray-400 dark:hover:text-white">Dismiss</button>
      </div>
    </div>}
    <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-hc-ink/70 hover:bg-hc-ink/5 dark:text-gray-300 dark:hover:bg-white/10">
      <Bell size={19} aria-hidden="true" />
      {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-hc-pink px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div role="dialog" aria-label="Notifications" className="absolute right-0 top-12 z-30 w-80 rounded-2xl border-2 border-hc-ink/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between"><strong>Notifications</strong>{unread > 0 && <button type="button" className="text-xs font-bold text-hc-violet" onClick={() => void api.markAllNotificationsRead().then(refresh).catch(() => undefined)}>Mark all read</button>}</div>
      {items.length === 0 ? <p className="py-5 text-center text-sm opacity-60">You’re all caught up.</p> : <ul className="space-y-1">{items.map((item) => <li key={item.id} className={item.readAt ? 'rounded-xl p-2' : 'rounded-xl bg-hc-violet/10 p-2'}><Link to={item.actionUrl} onClick={() => markRead(item)} className="block"><div className="flex items-center justify-between gap-2 text-sm font-bold"><span>{item.title}</span><time className="text-xs font-normal opacity-60">{relativeTime(item.createdAt)}</time></div><p className="mt-1 text-xs opacity-70">{item.message}</p><span className="mt-2 inline-block text-xs font-bold text-hc-violet">{item.actionLabel}</span></Link></li>)}</ul>}
    </div>}
  </div>;
}
