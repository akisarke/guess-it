import { Link } from 'react-router-dom';
import { StateCard } from '../components/StateCard';

export function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:py-20">
      <StateCard
        badge="404"
        title="That guess missed."
        description="This page does not exist, but there is always another round to play."
        primaryAction={{ label: 'Back to Guess It!', href: '/' }}
      />
    </main>
  );
}
