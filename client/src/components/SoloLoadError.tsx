import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { NotLoggedIn } from './NotLoggedIn';
import { StateCard } from './StateCard';

export function SoloLoadError({ error }: { error: Error }) {
  if (error instanceof ApiError && error.status === 401) {
    return <NotLoggedIn feature="generated sets" />;
  }
  const isNotFound = error instanceof ApiError && error.status === 404;
  return (
    <StateCard
      role="alert"
      badge="Error"
      title={isNotFound ? 'Set not found' : 'Set unavailable'}
      description={error.message}
      primaryAction={{ label: 'Back to Generate', href: '/generate' }}
    />
  );
}
