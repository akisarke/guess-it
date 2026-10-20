import type { QuestionPublic } from 'shared';

export function DuelQuestionCard({ question, value, disabled, onChange, onSubmit }: {
  question: QuestionPublic;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {

  const displayValue = /^\d+$/.test(value) ? Number(value).toLocaleString('en-US') : value;

  return (
    <section className="rounded-3xl border-2 border-ink/15 bg-white/80 p-5 dark:border-white/10 dark:bg-[var(--surface)] sm:p-7">
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink/50 dark:text-gray-400">Estimate in {question.unit}</span>
      {
}
      <h1 className="mt-4 break-words font-display text-3xl font-extrabold leading-tight text-ink dark:text-white sm:text-4xl">{question.prompt}</h1>
      <form className="mt-7 space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <label htmlFor="duel-estimate" className="sr-only">Your estimate in {question.unit}</label>
        <input
          id="duel-estimate"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={displayValue}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
          disabled={disabled}
          aria-label={`Your estimate in ${question.unit}`}
          className="input-field tabular-nums"
          placeholder="0"
        />
        <button type="submit" disabled={disabled || Number(value) <= 0} className="btn-primary w-full">{disabled ? 'Waiting for reveal...' : 'Lock estimate'}</button>
      </form>
    </section>
  );
}
