import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const EXAMPLES = [
  ['What would it cost to fill an Olympic pool with 2% milk?', 'Jeff'],
  ['How many tennis balls fit in a school bus?', 'Judy'],
  ['How many pet snakes live in England?', 'Robby'],
];

export function SubmitQuestion() {
  return (
    <section aria-labelledby="submit-question" className="shell-wide pb-16 sm:pb-24">
      <div className="card mx-auto max-w-xl text-center">
        <h2 id="submit-question" className="font-display text-2xl font-extrabold sm:text-3xl">
          Submit your own question
        </h2>
        <p className="mt-3 text-sm text-ink/60">Got an idea? Chalk it up.</p>

        <div className="mt-7 grid gap-5 text-left sm:grid-cols-2">
          {EXAMPLES.map(([question, author]) => (
            <p key={question} className="text-sm leading-6 font-medium italic text-ink/80">
              &ldquo;{question}&rdquo; <span className="text-ink/50">&mdash; {author}</span>
            </p>
          ))}
        </div>

        <Link to="/generate" className="btn-primary mt-8 w-full sm:w-auto">
          Submit a question <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}