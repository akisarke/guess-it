import { useRef } from 'react';
import { formatScore } from '../lib/format-number';

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SITE = typeof window === 'undefined' ? 'guessit.akisarke.xyz' : window.location.host;

interface ShareCardProps {
  puzzleNumber: number;
  scores: number[];
  average: number;
}

function band(score: number): string {
  if (score <= 1.5) return '#f4d53b';
  if (score <= 3.0) return '#8d877e';
  return '#ec3750';
}

export function ShareCard({ puzzleNumber, scores, average }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 600;
    canvas.height = 400;

    ctx.fillStyle = '#191817';
    ctx.fillRect(0, 0, 600, 400);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#ede9e0';
    ctx.font = `bold 32px ${SYSTEM_FONT}`;
    ctx.fillText(`Guess It! #${puzzleNumber}`, 300, 60);

    ctx.font = `24px ${SYSTEM_FONT}`;
    const answered = scores.filter((s) => s > 0);
    const rows = answered.length > 0 ? answered.length : 1;
    scores.forEach((score, i) => {
      if (score <= 0) return;
      ctx.fillStyle = band(score);
       ctx.fillText(`Q${i + 1}: ${formatScore(score).visual}`, 300, 120 + i * 40);
    });

    ctx.fillStyle = '#ede9e0';
    ctx.font = `bold 28px ${SYSTEM_FONT}`;
     const avgText = answered.length > 0 ? `Average: ${formatScore(average).visual}` : 'Average: -';
    ctx.fillText(avgText, 300, 180 + Math.max(rows, 1) * 40 + 40);

    ctx.fillStyle = '#8d877e';
    ctx.font = `16px ${SYSTEM_FONT}`;
    ctx.fillText(SITE, 300, 368);

    return canvas.toDataURL('image/png');
  };

  const buildText = (): string => {
    const lines = [`Guess It! #${puzzleNumber}`];
    scores.forEach((score, i) => {
      if (score > 0) lines.push(`Q${i + 1}: ${formatScore(score).visual}`);
    });
    const answered = scores.filter((s) => s > 0).length;
    lines.push(answered > 0 ? `Average: ${formatScore(average).visual}` : 'Average: -');
    lines.push(SITE);
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildText();
    const imageData = generateImage();

    try {
      if (navigator.share) {
        if (imageData) {
          const response = await fetch(imageData);
          if (!response.ok) throw new Error('Unable to prepare the share image.');
          const blob = await response.blob();
          const file = new File([blob], 'guess-it-result.png', { type: 'image/png' });
          await navigator.share({ files: [file], text });
        } else {
          await navigator.share({ text });
        }
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
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <div>
        <p className="text-sm font-bold text-ink dark:text-gray-100">Share this result</p>
        <p className="mt-1 text-xs text-ink/50 dark:text-gray-400">
          Creates a shareable result card with the same score colors.
        </p>
      </div>
      <button onClick={handleShare} className="btn-primary w-full">
        Share Result
      </button>
    </div>
  );
}
