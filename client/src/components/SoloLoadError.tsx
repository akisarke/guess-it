import { errorMessage, ApiError, needsAccount } from '../lib/api';
import { NotLoggedIn } from './NotLoggedIn';
import { StateCard } from './StateCard';

export function SoloLoadError({ error }: { error: Error }) {
  if (needsAccount(error)) {
    return <NotLoggedIn feature="generated sets" />;
  }
  const isNotFound = error instanceof ApiError && error.status === 404;
  return (
    <StateCard
      role="alert"
      badge="Error"
      title={isNotFound ? 'Set not found' : 'Set unavailable'}
      description={errorMessage(error, 'This question set could not be loaded. Try again.')}
      primaryAction={{ label: 'Back to Generate', href: '/generate' }}
    />
  );
}
