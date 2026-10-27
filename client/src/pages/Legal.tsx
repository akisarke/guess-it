import { Link } from 'react-router-dom';

type LegalKind = 'privacy' | 'terms' | 'cookies';

type Section = { heading: string; body: string; items?: readonly string[] };

const LAST_UPDATED = 'October 28, 2026';

const content: Record<LegalKind, { title: string; intro: string; sections: readonly Section[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'Guess It! is a daily estimation game. This page explains what we keep about you, who can see it, and which outside services touch it.',
    sections: [
      {
        heading: 'What we store',
        body: 'Only what the game needs to work:',
        items: [
          'Your account: display name, email address, and a hashed password, or your Hack Club account ID if you sign in with Hack Club. Anonymous play uses a temporary account so your daily progress is kept.',
          'Your play: daily guesses, scores, streaks, badges, duels, and the question sets you generate.',
          'Your profile: the bio and profile picture you choose to add.',
          'Social features: friends, friend requests, and notifications.',
        ],
      },
      {
        heading: 'What other players can see',
        body: 'Your display name, profile picture, bio, badges, streak, skill stats (average miss, best guess, recent days), leaderboard scores, and the titles and topics of question sets you made. Your email address is never shown, and the answers to your generated sets stay hidden.',
      },
      {
        heading: 'Services we rely on',
        body: 'A few outside services handle parts of the game for us:',
        items: [
          'Neon hosts the database.',
          'Resend sends verification and password-reset emails, so it receives your email address when one is sent.',
          "Google Gemini writes generated question sets. It receives the topic you type and a list of questions to avoid repeating. It doesn't receive your account details.",
          'Hack Club, if you sign in with it, shares your Hack Club account ID and email address with us.',
        ],
      },
      {
        heading: 'Stored in your browser',
        body: 'Some settings and your hard mode history live only in your browser. The Cookie Policy lists them.',
      },
      {
        heading: 'How we use it',
        body: 'To run the game, keep accounts secure, calculate scores, stop players getting the same question twice, and keep the service reliable. We do not sell personal information or use it for advertising.',
      },
      {
        heading: 'Your choices',
        body: 'You can edit your bio and profile picture at any time, and unlink Hack Club once your account has an email and password. To delete your account or ask about your data, contact the service owner through the project\'s support channel.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'Play fair. Guess It! is a daily game for fun: no automation, no scraping, no spoiling it for others.',
    sections: [
      { heading: 'The service', body: 'Guess It! is an estimation game provided as-is. Daily questions, features, and availability may change at any time.' },
      { heading: 'Scores and hard mode', body: 'Your daily guesses count toward scores, streaks, badges, and leaderboards. Hard mode replays past puzzles for practice only and never changes your daily score.' },
      { heading: 'Generated questions', body: 'Question sets from the Generate page are written by AI. Their answers are best estimates and can be wrong, so treat them as practice, not fact.' },
      { heading: 'Your content', body: 'Display names, bios, and profile pictures must not be offensive, misleading, or someone else\'s. We may remove content or suspend accounts that break these rules.' },
      { heading: 'Fair play', body: 'Do not abuse the service, automate play, interfere with other players, or try to access data that is not yours.' },
      { heading: 'Accounts', body: 'Keep your sign-in details private. You are responsible for activity under your account.' },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    intro: 'Guess It! uses only the cookies it needs to sign you in and keep requests secure, plus a few settings saved in your browser. Nothing is used for tracking or advertising.',
    sections: [
      {
        heading: 'Cookies',
        body: 'These are required for the game to work:',
        items: [
          'guessit_session keeps you signed in, including anonymous play.',
          'guessit_csrf protects actions like saving a guess or editing your profile.',
          'oauth_state and oauth_mode last only for the few seconds of a Hack Club sign-in.',
        ],
      },
      {
        heading: 'Saved in your browser',
        body: 'These stay on your device and are never sent to us:',
        items: [
          'Your theme, sound setting, and whether you dismissed the cookie notice.',
          'Whether hard mode is on, and which daily guesses you made in hard mode.',
          'Your hard mode runs and the past puzzles you have seen, so you never get the same question twice.',
          'Notes you write in the calculator scratch pad.',
        ],
      },
      {
        heading: 'Managing them',
        body: 'You can clear cookies and site data in your browser settings. Clearing the session cookie signs you out and may remove anonymous progress. Clearing site data also resets your settings and hard mode history.',
      },
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
          <p className="max-w-2xl text-base leading-7 text-ink/70 dark:text-gray-300">{page.intro}</p>
          <p className="text-xs font-bold text-ink/70 dark:text-gray-400">Last updated {LAST_UPDATED}</p>
        </div>
        <div className="space-y-6">
          {page.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="font-display text-xl font-extrabold text-ink dark:text-white">{section.heading}</h2>
              <p className="max-w-prose leading-7 text-ink/75 dark:text-gray-300">{section.body}</p>
              {section.items && (
                <ul className="max-w-prose list-disc space-y-1.5 pl-5 leading-7 text-ink/75 marker:text-ink/40 dark:text-gray-300">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
