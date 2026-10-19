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
    <div className="w-full">
      <div className="relative">
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
          className="input-field pr-24 text-3xl sm:pr-28 sm:text-4xl md:text-5xl"
        />
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-bold text-ink/50 dark:text-gray-400 sm:right-7 sm:text-xl">
          {unit}
        </span>
      </div>
    </div>
  );
}
