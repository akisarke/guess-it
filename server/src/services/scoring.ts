import { ScoreDirection, ScoreBand } from 'shared';

export function computeScore(guess: number, answer: number): {
  score: number;
  direction: ScoreDirection;
  scoreBand: ScoreBand;
} {
  if (answer === 0) {
    return { score: Infinity, direction: 'Too High', scoreBand: 'far' };
  }

  const ratio = guess / answer;
  const inverseRatio = answer / guess;
  const score = Math.max(ratio, inverseRatio);

  const roundedScore = Math.round(score * 100) / 100;

  let direction: ScoreDirection;
  if (guess === answer) {
    direction = 'Exact';
  } else if (guess < answer) {
    direction = 'Too Low';
  } else {
    direction = 'Too High';
  }

  let scoreBand: ScoreBand;
  if (roundedScore <= 1.5) {
    scoreBand = 'close';
  } else if (roundedScore <= 3.0) {
    scoreBand = 'medium';
  } else {
    scoreBand = 'far';
  }

  return { score: roundedScore, direction, scoreBand };
}
