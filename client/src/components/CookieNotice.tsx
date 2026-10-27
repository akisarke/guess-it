import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const COOKIE_NOTICE_KEY = 'guessit-cookie-notice-dismissed';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== '1');
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(COOKIE_NOTICE_KEY, '1');
    setVisible(false);
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-[3px] border-2 border-ink/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-gray-900" role="status">
      <p className="text-sm leading-6 text-ink/70 dark:text-gray-200">
        Guess It! uses essential cookies for sessions and security. <Link to="/cookies" className="font-bold text-accent underline">Cookie policy</Link>
      </p>
      <button type="button" className="btn-primary mt-3 w-full" onClick={dismiss}>Got it</button>
    </aside>
  );
}
