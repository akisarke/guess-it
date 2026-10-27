import { ChevronDown } from 'lucide-react';

const FAQS: Array<[string, string]> = [
  [
    'What is Guess It?',
    'A daily estimation game. You get three questions a day, lock in a number for each, and we score how close you landed.',
  ],
  ['Can I use a calculator?', 'Yes. Every question page has a built-in calculator for napkin math.'],
  [
    'How does scoring work?',
    'Each guess is scored as a multiple of the real answer. 1.00× is perfect, and closer always beats further.',
  ],
  ['When does the new puzzle drop?', 'A new puzzle drops every 24 hours with three fresh questions.'],
];

export function Faqs() {
  return (
    <section aria-labelledby="faqs" className="shell-wide pb-16 sm:pb-24">
      <h2 id="faqs" className="border-b-2 border-[var(--line-strong)] pb-3 font-display text-2xl font-extrabold tracking-tight text-ink dark:text-gray-100 sm:text-3xl">
        Questions people ask
      </h2>

      <ul>
        {FAQS.map(([question, answer]) => (
          <li key={question} className="border-b border-[var(--line)]">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 dark:text-gray-100">
                <span>{question}</span>
                <ChevronDown
                  size={16}
                  className="shrink-0 transition-transform duration-200 group-open:rotate-180 text-ink/50 dark:text-gray-400"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-prose pb-5 pr-8 text-sm leading-6 text-ink/70 dark:text-gray-300">{answer}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
