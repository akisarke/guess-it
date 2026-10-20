import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthRecoveryShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="auth-page"><section className="auth-panel mx-auto w-full max-w-xl"><span className="chip chip-active">Account recovery</span><h1 className="mt-8 font-display text-4xl font-extrabold text-ink dark:text-gray-100">{title}</h1><p className="mt-3 text-sm leading-6 text-ink/60 dark:text-gray-300">{description}</p>{children}<Link className="mt-6 inline-block font-bold text-accent underline" to="/login">Back to sign in</Link></section></main>;
}
