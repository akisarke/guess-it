import { useEffect, useMemo, useRef, useState } from 'react';
import { Delete, Trash2 } from 'lucide-react';
import { evaluate } from '../lib/calculator';
import { CALCULATOR_BUTTONS } from 'shared';

interface CalculatorProps {
  onUseResult: (value: number) => void;
  onClose: () => void;
}

const NOTE_KEY = 'guessit-scratch-pad';

function isCalculatorKey(key: string): boolean {
  return /^[0-9.+\-−×÷()^%]$/.test(key) || key === 'Backspace' || key === 'Enter' || key === 'Escape';
}

export function Calculator({ onUseResult, onClose }: CalculatorProps) {
  const [expression, setExpression] = useState('');
  const [note, setNote] = useState<string>(() => {
    try {
      return localStorage.getItem(NOTE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const displayRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(NOTE_KEY, note);
    } catch {

    }
  }, [note]);

  useEffect(() => {
    displayRef.current?.focus();
  }, []);

  const result = useMemo(() => {
    if (!expression) return null;
    const value = evaluate(expression);
    return Number.isFinite(value) ? value : null;
  }, [expression]);

  const press = (btn: string) =>
    setExpression((prev) => (btn === 'C' ? '' : btn === '⌫' ? prev.slice(0, -1) : prev + btn));

  const handleKeyDown = (event: React.KeyboardEvent) => {

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    const target = event.target as HTMLElement;
    const isTextEntry =
      target.isContentEditable ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && !target.readOnly);
    if (isTextEntry) return;

    if (!isCalculatorKey(event.key)) return;
    event.preventDefault();

    if (event.key === 'Enter') {
      if (result !== null) onUseResult(result);
    } else if (event.key === 'Backspace') {
      press('⌫');
    } else {
      setExpression((prev) => prev + event.key);
    }
  };

  const canUse = result !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calculator-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)]"
      >
        <h2 id="calculator-title" className="sr-only">
          Calculator and scratch pad
        </h2>

        <div className="grid sm:grid-cols-[minmax(0,1fr)_19rem]">
          {
}
          <div className="order-1 p-4 sm:order-2 sm:p-5">
            <input
              ref={displayRef}
              readOnly
              value={expression || '0'}
              aria-label="Expression"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-right text-3xl font-mono text-ink outline-none dark:text-gray-100"
            />

            <p
              className="mt-2 min-h-[1.75rem] text-right font-display text-xl font-bold tabular-nums text-accent"
              aria-live="polite"
            >
              {result !== null ? `= ${result.toLocaleString()}` : ''}
            </p>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {CALCULATOR_BUTTONS.flat().map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => press(btn)}
                  className="flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] py-3.5 font-bold text-ink transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-[0.97] dark:text-gray-100"
                >
                  {
}
                  {btn === '⌫' ? <Delete size={18} aria-hidden="true" /> : btn}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => result !== null && onUseResult(result)}
                className="btn-primary flex-1"
                disabled={!canUse}
              >
                Use Result
              </button>
            </div>
          </div>

          <section className="order-2 flex min-h-[16rem] flex-col border-t border-[var(--line)] sm:order-1 sm:border-r sm:border-t-0">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.11em] text-ink/60 dark:text-gray-400">
                Scratch pad
              </span>
              <button
                type="button"
                onClick={() => setNote('')}
                aria-label="Clear scratch pad"
                className="rounded-md p-1.5 text-ink/50 transition-colors hover:bg-[var(--surface-2)] hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>

            <label className="sr-only" htmlFor="scratch-pad">
              Scratch pad notes
            </label>
            <textarea
              id="scratch-pad"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Jot notes, work things out..."
              spellCheck={false}
              className="flex-1 resize-none bg-transparent p-4 text-sm leading-6 text-ink outline-none placeholder:text-ink/35 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
