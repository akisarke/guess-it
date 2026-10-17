import { StateCard } from './StateCard';

interface AuthUnavailableProps {
  readonly onRetry: () => void;
}

export function AuthUnavailable({ onRetry }: AuthUnavailableProps) {
  return (
    <StateCard
      badge="Temporary issue"
      title="Authentication unavailable"
      description="We could not check your account. Try again to continue."
      retryAction={onRetry}
    />
  );
}
