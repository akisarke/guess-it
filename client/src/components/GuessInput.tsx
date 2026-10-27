interface GuessInputProps {
  unit: string;
  value: number;
  onChange: (value: number) => void;
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

export function GuessInput({ unit, value, onChange, onSubmit, disabled }: GuessInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    onChange(Number.parseInt(raw, 10) || 0);
  };

  const handleSubmit = () => {
    if (value > 0) {
      onSubmit(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const displayValue = value > 0 ? value.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '';

  return (
    <div className="flex items-baseline gap-3 border-b-2 border-ink pb-2">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="0"
        aria-label={`Guess in ${unit}`}
        className="w-full bg-transparent py-1 font-mono text-4xl font-bold tabular-nums outline-none placeholder:text-ink/25 disabled:opacity-50 dark:placeholder:text-white/25 sm:text-5xl"
      />
      <span className="shrink-0 pb-1 text-xs font-bold tracking-[0.03em] opacity-55">{unit}</span>
    </div>
  );
}
