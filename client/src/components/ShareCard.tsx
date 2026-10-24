import { SCORE_BANDS } from 'shared';
import { formatScore } from '../lib/format-number';

interface ShareCardProps {
  puzzleNumber: number;
  scores: number[];
  average: number;
}

function band(score: number): string {
  if (score <= SCORE_BANDS.close.max) return SCORE_BANDS.close.color;
  if (score <= SCORE_BANDS.medium.max) return SCORE_BANDS.medium.color;
  return SCORE_BANDS.far.color;
}

export function ShareCard({ puzzleNumber, scores, average }: ShareCardProps) {
  const buildText = (): string => {
    const lines = [`Guess It! #${puzzleNumber}`];
    scores.forEach((score, i) => {
      if (score > 0) lines.push(`Q${i + 1}: ${formatScore(score).visual}`);
    });
    const answered = scores.filter((s) => s > 0).length;
    lines.push(answered > 0 ? `Average: ${formatScore(average).visual}` : 'Average: -');
    lines.push(typeof window === 'undefined' ? 'guessit.akisarke.xyz' : window.location.host);
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildText();

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Copied your result to the clipboard!');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        alert('Copied your result to the clipboard!');
      } catch {
        alert('Could not share your result.');
      }
    }
  };

  return (
    <button type="button" onClick={handleShare} className="btn-primary w-full">
      Share Result
    </button>
  );
}
