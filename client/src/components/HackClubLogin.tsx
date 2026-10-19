import { api } from '../lib/api';

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
