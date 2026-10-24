import type { ReactNode } from 'react';
import { ArrowRight, Calculator, ChevronUp, Copy, Share2, Smartphone } from 'lucide-react';
import { DistributionGraph } from '../../components/DistributionGraph';
import type { DistributionResponse, ScoreBand } from 'shared';

const MOCK_DISTRIBUTION: DistributionResponse = {
  bins: [
    { low: 180, high: 300, count: 6 },
    { low: 300, high: 500, count: 12 },
    { low: 500, high: 800, count: 20 },
    { low: 800, high: 1200, count: 28 },
    { low: 1200, high: 1800, count: 36 },
    { low: 1800, high: 2500, count: 44 },
    { low: 2500, high: 3500, count: 52 },
    { low: 3500, high: 5000, count: 58 },
    { low: 5000, high: 7000, count: 54 },
    { low: 7000, high: 10000, count: 47 },
    { low: 10000, high: 15000, count: 40 },
    { low: 15000, high: 20000, count: 33 },
    { low: 20000, high: 30000, count: 26 },
    { low: 30000, high: 50000, count: 19 },
    { low: 50000, high: 80000, count: 13 },
    { low: 80000, high: 120000, count: 9 },
    { low: 120000, high: 180000, count: 6 },
    { low: 180000, high: 250000, count: 4 },
  ],
  userGuess: 1245,
  medianGuess: 4200,
  answer: 1800,
  napkinMath: '300M US phones × ~2.5 upgrades/person = 750M\n~1.1B global phones × ~1.8 upgrades/person = ~2B',
  sourceTitle: 'Apple press releases',
  sourceUrl: 'https://apple.com/newsroom',
};

const MOCK_SCORE_BAND: ScoreBand = 'medium';

function PreviewCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="card">
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink/50 dark:text-gray-400 mb-4">{label}</p>
      {children}
    </div>
  );
}

function GuessCard() {
  return (
    <PreviewCard label="Q1 / 3">
      <p className="mt-1 text-base font-extrabold leading-snug sm:text-lg text-ink dark:text-gray-100">
        How many iPhones have been produced since the launch in 2007?
      </p>
      <div className="mt-5 flex items-end justify-between gap-3 border-b border-line/50 pb-3">
        <label htmlFor="demo-guess" className="sr-only">Your guess</label>
        <div className="flex-1 flex items-end gap-2">
          <input
            id="demo-guess"
            type="text"
            defaultValue="1,245"
            readOnly
            className="flex-1 font-mono text-xl text-ink dark:text-gray-100 bg-transparent border-0 outline-none placeholder-ink/30 dark:placeholder-gray-500"
            placeholder="your guess"
          />
          <span className="text-sm font-medium text-ink/60 dark:text-gray-400 whitespace-nowrap">iPhones</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2" aria-hidden="true">
        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-line/50 text-ink/60 hover:text-ink hover:border-ink/30 dark:text-gray-300/70 dark:hover:text-gray-100 dark:hover:border-gray-300/30" aria-label="Calculator">
          <Calculator size={16} />
        </button>
        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-line/50 text-ink/60 hover:text-ink hover:border-ink/30 dark:text-gray-300/70 dark:hover:text-gray-100 dark:hover:border-gray-300/30" aria-label="Phone">
          <Smartphone size={16} />
        </button>
      </div>
      <button type="button" className="mt-5 btn-primary w-full" aria-hidden="true">
        Lock it in <ArrowRight size={13} aria-hidden="true" />
      </button>
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true" role="tablist" aria-label="Question progress">
        <span className="h-1.5 w-6 rounded-full bg-accent" role="tab" aria-selected="true" aria-label="Question 1" />
        <span className="h-1.5 w-6 rounded-full bg-ink/15 dark:bg-gray-600/30" role="tab" aria-selected="false" aria-label="Question 2" />
        <span className="h-1.5 w-6 rounded-full bg-ink/15 dark:bg-gray-600/30" role="tab" aria-selected="false" aria-label="Question 3" />
      </div>
    </PreviewCard>
  );
}

function RevealCard() {
  return (
    <PreviewCard label="Q1 / 3">
      <p className="mt-1 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink/50 dark:text-gray-400">You guessed</p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none sm:text-4xl text-ink dark:text-gray-100">1,245</p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-accent-ink">
        <span className="text-[0.66rem] font-bold uppercase tracking-[0.12em]">Answer</span>
        <span className="font-display text-xl font-extrabold">1,800</span>
        <span className="text-[0.66rem] font-bold uppercase tracking-[0.12em]">Oreos</span>
      </div>

      <p className="mt-4 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink/50 dark:text-gray-400">You landed</p>
      <p className="mt-1 font-display text-xl font-extrabold text-ink dark:text-gray-100">1.45× Too Low</p>
      <p className="mt-1 text-sm text-ink/60 dark:text-gray-400">closer than 62% of players</p>

      <div className="mt-5">
        <DistributionGraph data={MOCK_DISTRIBUTION} userGuess={1245} userScoreBand={MOCK_SCORE_BAND} />
      </div>

      <details className="mt-5 group">
        <summary className="flex items-center justify-between cursor-pointer list-none border-t border-line/50 pt-3">
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink dark:text-gray-100">Napkin math</span>
          <ChevronUp size={14} className="shrink-0 transition-transform duration-200 group-open:rotate-180 text-ink/50 dark:text-gray-400" aria-hidden="true" />
        </summary>
        <div className="mt-3 p-3 rounded-lg bg-surface-2 border border-line/50 text-sm text-ink/80 dark:text-gray-200 space-y-2 font-mono">
          <p><span className="font-semibold">300M</span> US phones × <span className="font-semibold">~2.5</span> upgrades/person = <span className="font-semibold">750M</span></p>
          <p><span className="font-semibold">~1.1B</span> global phones × <span className="font-semibold">~1.8</span> upgrades/person = <span className="font-semibold">~2B</span></p>
        </div>
      </details>

      <button type="button" className="mt-5 btn-secondary w-full" aria-hidden="true">
        Question 2 <ArrowRight size={13} aria-hidden="true" />
      </button>
    </PreviewCard>
  );
}

function SummaryCard() {
  const rows = [
    ['How many Oreos are eaten in the US each day?', '< 1.45×'],
    ['How many paper bus tickets are printed in London each year?', '> 2.18×'],
    ['How many steps does a mail carrier walk in a year?', '< 2.30×'],
  ];

  return (
    <PreviewCard label="Questions">
      <div className="flex items-center justify-between gap-3 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink/50 dark:text-gray-400">
        <span>1×</span>
        <span>10×</span>
        <span>100×</span>
        <span>1,000×</span>
      </div>
      <div className="mt-2 h-px bg-ink/10 dark:bg-gray-600/30" />
      <ul className="mt-3 space-y-1 divide-y divide-line/50">
        {rows.map(([question, score]) => (
          <li key={question} className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-medium leading-5 text-ink/90 dark:text-gray-100">{question}</span>
            <span className="shrink-0 font-display text-sm font-extrabold text-ink dark:text-gray-100">{score}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3" aria-hidden="true">
        <button type="button" className="btn-primary flex-1 min-w-[140px]">
          <Share2 size={14} aria-hidden="true" /> Share card
        </button>
        <button type="button" className="btn-secondary flex-1 min-w-[140px]">
          <Copy size={14} aria-hidden="true" /> Copy text
        </button>
      </div>
    </PreviewCard>
  );
}

function Step({ title, children, card, reverse }: { title: ReactNode; children: ReactNode; card: ReactNode; reverse?: boolean }) {
  return (
    <li className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className={reverse ? 'lg:order-2' : ''}>
        <h3 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl text-ink dark:text-gray-100">{title}</h3>
        <p className="mt-4 max-w-md text-base leading-7 text-ink/70 dark:text-gray-300">{children}</p>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>{card}</div>
    </li>
  );
}

export function HowToPlay() {
  return (
    <section aria-labelledby="how-to-play" className="shell-wide py-16 sm:py-24">
      <h2 id="how-to-play" className="text-center font-display text-3xl font-extrabold sm:text-5xl text-ink dark:text-gray-100">
        How to <strong className="text-accent">Play</strong>
      </h2>

      <ol className="mt-14 space-y-16 sm:mt-20 sm:space-y-24">
        <Step
          title={
            <>
              <span className="text-accent">01.</span> Make your best <strong className="text-accent">guess</strong>
            </>
          }
          card={<GuessCard />}
        >
          No Googling. Just napkin math, gut instinct, and a built-in calculator when you need it.
        </Step>

        <Step
          title={
            <>
              <span className="text-accent">02.</span> See how close you <strong className="text-accent">were</strong>
            </>
          }
          card={<RevealCard />}
          reverse
        >
          We reveal the answer and score you based on how far off you are, as a multiple of the real answer. We also
          give you some example math you could have used.
        </Step>

        <Step
          title={
            <>
              <span className="text-accent">03.</span> Compare with <strong className="text-accent">friends</strong>
            </>
          }
          card={<SummaryCard />}
        >
          Get your daily score, see how you compared to the rest of the players, and share your result with friends.
        </Step>
      </ol>
    </section>
  );
}