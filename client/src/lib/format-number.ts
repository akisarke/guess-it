const COMPACT_UNITS = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
] as const;

const DUEL_TIMEOUT_SCORE = 1e18;

function requireDisplayNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Display values must be finite and non-negative.');
  return value;
}

export function formatExactNumber(value: number): string {
  return requireDisplayNumber(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function formatCompactNumber(value: number): string {
  const safeValue = requireDisplayNumber(value);
  const unit = COMPACT_UNITS.find(({ value: unitValue }) => safeValue >= unitValue);
  if (!unit) return safeValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${(safeValue / unit.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit.suffix}`;
}

export function formatScore(value: number): { readonly visual: string; readonly exact: string; readonly isTimeout: boolean } {
  if (value === DUEL_TIMEOUT_SCORE) return { visual: 'Timed out', exact: 'Timed out', isTimeout: true };
  return { visual: `${formatCompactNumber(value)}×`, exact: `${formatExactNumber(value)}×`, isTimeout: false };
}
