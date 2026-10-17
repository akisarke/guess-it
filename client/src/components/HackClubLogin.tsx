import { api } from '../lib/api';

/**
 * "Sign in with Hack Club" button. Redirects the browser to the Hack Club
 * OAuth flow (see server/src/routes/auth.ts -> GET /api/auth/hackclub/start).
 */
export function HackClubLogin({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => api.loginHackClub()}
      className={className}
    >
      Sign in with Hack Club
    </button>
  );
}
