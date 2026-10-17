import { useState } from 'react';
import { evaluate } from '../lib/calculator';
import { CALCULATOR_BUTTONS } from 'shared';

interface CalculatorProps {
  onUseResult: (value: number) => void;
  onClose: () => void;
}

export function Calculator({ onUseResult, onClose }: CalculatorProps) {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const handleButton = (btn: string) => {
    if (btn === 'C') {
      setExpression('');
      setResult(null);
    } else if (btn === '⌫') {
      const newExpr = expression.slice(0, -1);
      setExpression(newExpr);
      if (newExpr) setResult(evaluate(newExpr));
      else setResult(null);
    } else {
      const newExpr = expression + btn;
      setExpression(newExpr);
      try {
        setResult(evaluate(newExpr));
      } catch {
        setResult(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-4 h-12 overflow-x-auto overflow-y-hidden whitespace-nowrap text-right text-3xl font-mono">
          {expression || '0'}
        </div>
        {result !== null && (
          <div className="text-center font-display text-2xl font-bold text-hc-violet mb-4">
            = {result.toLocaleString()}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {CALCULATOR_BUTTONS.flat().map((btn) => (
            <button
              key={btn}
              onClick={() => handleButton(btn)}
              className="bg-hc-ink/5 dark:bg-white/10 hover:bg-hc-violet/15 dark:hover:bg-white/15 rounded-2xl py-3 text-lg font-semibold text-hc-ink dark:text-gray-100 transition-colors active:scale-[0.96]"
            >
              {btn}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => result !== null && onUseResult(result)}
            className="btn-primary flex-1"
            disabled={result === null}
          >
            Use Result
          </button>
        </div>
      </div>
    </div>
  );
}
