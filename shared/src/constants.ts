import type { Badge } from './types.js';

export const BADGE_DEFINITIONS: Badge[] = [
  { id: 'streak7', name: 'On Fire', description: '7-day play streak', isSecret: false, isManualGrant: false },
  { id: 'streak30', name: 'Unstoppable', description: '30-day play streak', isSecret: false, isManualGrant: false },
  { id: 'exact', name: 'Bullseye', description: 'Scored an exact 1.0× guess', isSecret: false, isManualGrant: false },
  { id: 'sharp', name: 'Sharpshooter', description: 'Day average score below 1.1×', isSecret: false, isManualGrant: false },
];

export const SCORE_BANDS = {
  close: { max: 1.5, color: '#22c55e', label: 'Close' },
  medium: { max: 3.0, color: '#eab308', label: 'Medium' },
  far: { max: Infinity, color: '#ef4444', label: 'Far' },
} as const;

export const DAILY_UNITS = [
  'PINEAPPLES', 'RUBBER DUCKS', 'BICYCLES', 'AIRPLANES', 'STARS',
  'CARS', 'BOOKS', 'PIZZAS', 'LAPTOPS', 'TREES',
  'SHOES', 'CANDLES', 'BIRDS', 'BOATS', 'HATS',
];

export const UNITS = DAILY_UNITS;

export const CALCULATOR_BUTTONS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '%', '+'],
  ['(', ')', 'C', '⌫'],
];
