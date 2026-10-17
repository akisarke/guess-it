import type { QuestionPublic } from 'shared';

export function DuelQuestionCard({ question, value, disabled, onChange, onSubmit }: {
  readonly question: QuestionPublic;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="rounded-3xl border-2 border-hc-ink/15 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5 sm:p-7">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-hc-ink/50 dark:text-gray-400">Estimate in {question.unit}</span>
      <h2 className="mt-4 break-words font-display text-3xl font-extrabold leading-tight text-hc-ink dark:text-white sm:text-4xl">{question.prompt}</h2>
      <form className="mt-7 space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <label htmlFor="duel-estimate" className="sr-only">Your estimate in {question.unit}</label>
        <input id="duel-estimate" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-2xl border-2 border-hc-ink/15 bg-white px-4 py-4 text-2xl font-bold text-hc-ink outline-none focus:border-hc-violet focus:ring-4 focus:ring-hc-violet/20 disabled:opacity-60 dark:border-white/15 dark:bg-gray-900 dark:text-white" placeholder="Enter an estimate" />
        <button type="submit" disabled={disabled || Number(value) <= 0} className="btn-primary w-full">{disabled ? 'Waiting for reveal...' : 'Lock estimate'}</button>
      </form>
    </section>
  );
}
