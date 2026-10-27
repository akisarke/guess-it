import { StateCard } from './StateCard';

interface NotLoggedInProps {
  feature: string;
  inline?: boolean;
}

export function NotLoggedIn({ feature, inline }: NotLoggedInProps) {
  return (
    <StateCard
      badge="Account needed"
      title="Not Logged In"
      description={`Log in or create account to use ${feature}.`}
      primaryAction={{ label: 'Log in', href: '/login' }}
      secondaryAction={{ label: 'Create account', href: '/signup' }}
      inline={inline}
    />
  );
}
