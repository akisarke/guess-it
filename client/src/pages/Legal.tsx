import { Link } from 'react-router-dom';

type LegalKind = 'privacy' | 'terms' | 'cookies';

const content: Record<LegalKind, { title: string; intro: string; sections: readonly { heading: string; body: string }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'Guess It! keeps the information needed to run your account and your game progress.',
    sections: [
      { heading: 'What we store', body: 'Account details, guesses, scores, streaks, and profile information you choose to add. Anonymous play uses a temporary account so your daily progress can be saved.' },
      { heading: 'How we use it', body: 'We use this information to provide the game, protect accounts, calculate scores, and improve reliability. We do not sell personal information.' },
      { heading: 'Your choices', body: 'You can stop using the service at any time. Contact the service owner through the project\'s support channel for account or data questions.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'Use Guess It! fairly and only for its intended purpose.',
    sections: [
      { heading: 'The service', body: 'Guess It! is an estimation game provided as-is. Availability, daily questions, and features may change.' },
      { heading: 'Fair play', body: 'Do not abuse the service, automate play, interfere with other players, or attempt to access data that does not belong to you.' },
      { heading: 'Accounts', body: 'You are responsible for keeping account credentials private and for activity under your account.' },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    intro: 'Guess It! uses a small number of cookies required for sessions and security.',
    sections: [
      { heading: 'Essential cookies', body: 'Session and security cookies keep you signed in and protect state-changing requests. They are required for account and daily-puzzle play.' },
      { heading: 'Preferences', body: 'The app may store local preferences such as theme and sound settings in your browser. These are not used for advertising.' },
      { heading: 'Managing cookies', body: 'You can clear cookies from your browser settings. Clearing the session cookie signs you out and may remove temporary anonymous progress.' },
    ],
  },
};

export function Legal({ kind }: { kind: LegalKind }) {
  const page = content[kind];
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <article className="card space-y-8">
        <div className="space-y-3">
          <Link to="/" className="nav-link">Back to Guess It!</Link>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink dark:text-white sm:text-5xl">{page.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-ink/65 dark:text-gray-300">{page.intro}</p>
        </div>
        <div className="space-y-6">
          {page.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="font-display text-xl font-extrabold text-ink dark:text-white">{section.heading}</h2>
              <p className="leading-7 text-ink/70 dark:text-gray-300">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
