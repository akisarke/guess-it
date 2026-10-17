import { SCORE_BANDS } from 'shared';
import type { DistributionResponse, ScoreBand } from 'shared';

interface DistributionGraphProps {
  data: DistributionResponse | null;
  userGuess: number | null;
  userScoreBand: ScoreBand;
}

function logPos(value: number, logMin: number, logMax: number): number {
  if (value <= 0) return 0;
  const logVal = Math.log10(value);
  if (logMax <= logMin) return 0;
  return Math.min(1, Math.max(0, (logVal - logMin) / (logMax - logMin)));
}

export function DistributionGraph({ data, userGuess, userScoreBand }: DistributionGraphProps) {
  if (!data || !data.bins || data.bins.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-hc-ink/90 dark:text-gray-100">How everyone guessed</h3>
            <p className="mt-1 text-xs text-hc-ink/65 dark:text-gray-400">A snapshot of the guessing crowd</p>
          </div>
          <span className="chip chip-idle !px-2.5 !py-1 text-xs">log scale</span>
        </div>
        <div className="rounded-[1.5rem] border-2 border-dashed border-hc-ink/10 bg-white/50 p-4 text-center dark:border-white/15 dark:bg-white/5">
          <p className="text-sm font-semibold text-hc-ink/70 dark:text-gray-200">No distribution data yet — lock in a guess to start it.</p>
        </div>
      </div>
    );
  }

  const bins = data.bins;
  const maxCount = Math.max(...bins.map((b) => b.count));
  const first = bins[0];
  const last = bins[bins.length - 1];
  const logMin = Math.log10(first.low);
  const logMax = Math.log10(last.high);

  const answerPos = logPos(data.answer, logMin, logMax);
  const medianPos = logPos(data.medianGuess, logMin, logMax);
  const userPos = userGuess != null ? logPos(userGuess, logMin, logMax) : null;
  const markerDelay = bins.length * 40 + 640;
  const labelDelay = markerDelay + 150;
  const totalGuesses = bins.reduce((sum, b) => sum + b.count, 0);
  const isSparse = totalGuesses > 0 && totalGuesses < 5;
  const chartSummary = `Guess distribution across ${bins.length} ranges. Answer: ${data.answer.toLocaleString()}. Median guess: ${data.medianGuess.toLocaleString()}. Your guess: ${userGuess != null ? userGuess.toLocaleString() : 'not available'}.`;
  const userMarkerColor = 'var(--marker-you, var(--hc-yellow))';
  const answerMarkerColor = 'var(--marker-answer, var(--hc-blue))';
  // Stagger marker labels vertically when markers sit close together so
  // "answer", "median" and "you" never render on top of each other.
  const markerLevels = (() => {
    const markers: { key: 'answer' | 'median' | 'user'; pos: number }[] = [
      { key: 'answer', pos: answerPos },
      { key: 'median', pos: medianPos },
    ];
    if (userPos !== null) markers.push({ key: 'user', pos: userPos });
    const ordered = [...markers].sort((a, b) => a.pos - b.pos);
    const levels = new Map<string, number>();
    let level = 0;
    ordered.forEach((m, i) => {
      if (i > 0 && m.pos - ordered[i - 1].pos < 0.09) level += 1;
      else if (i > 0) level = 0;
      levels.set(m.key, level);
    });
    return levels;
  })();
  const labelTop = (key: 'answer' | 'median' | 'user') =>
    `${-1.5 - (markerLevels.get(key) ?? 0) * 1.1}rem`;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-hc-ink/90 dark:text-gray-100">How everyone guessed</h3>
          <p className="mt-1 text-xs text-hc-ink/65 dark:text-gray-400">A snapshot of the guessing crowd</p>
        </div>
        <span className="chip chip-idle !px-2.5 !py-1 text-xs">log scale</span>
      </div>

      <div className="graph-frame" role="img" aria-label={chartSummary}>
        <div className="graph-grid" aria-hidden="true" />
        <div className="relative flex h-44 items-end gap-1 px-1 pb-1 sm:h-52 lg:h-56">
          {bins.map((bin, i) => (
            <div key={i} className="flex h-full flex-1 items-end">
              <div
                className="graph-bar"
                style={{
                  height: `${(bin.count / maxCount) * 100}%`,
                  animationDelay: `${i * 40}ms`,
                }}
              />
            </div>
          ))}

          <div className="graph-baseline" aria-hidden="true" />

          {userPos !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ left: `${userPos * 100}%` }}
            >
              <div
                className="graph-marker-line"
                style={{ backgroundColor: userMarkerColor, animationDelay: `${markerDelay}ms` }}
              />
              <div
                className="graph-marker-label absolute left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-[0.22em] whitespace-nowrap"
                style={{ color: 'var(--marker-you, #8b3556)', top: labelTop('user'), animationDelay: `${labelDelay}ms` }}
              >
                You
              </div>
            </div>
          )}

          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${medianPos * 100}%` }}
          >
            <div
              className="graph-marker-line graph-marker-line--dashed"
              style={{ animationDelay: `${markerDelay + 40}ms` }}
            />
            <div
              className="graph-marker-label absolute left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.22em] text-hc-ink/70 dark:text-white/70 whitespace-nowrap"
              style={{ top: labelTop('median'), animationDelay: `${labelDelay + 40}ms` }}
            >
              median
            </div>
          </div>

          <div
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
            style={{ left: `${answerPos * 100}%` }}
          >
            <div
              className="graph-marker-line"
              style={{ backgroundColor: answerMarkerColor, animationDelay: `${markerDelay + 80}ms` }}
            />
            <div
              className="graph-marker-label absolute left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-[0.22em] whitespace-nowrap"
              style={{ color: 'var(--marker-answer, #1d4ed8)', top: labelTop('answer'), animationDelay: `${labelDelay + 80}ms` }}
            >
              answer
            </div>
          </div>
        </div>
      </div>

      {isSparse && (
        <p className="rounded-2xl border-2 border-dashed border-hc-ink/10 bg-white/60 px-4 py-3 text-center text-sm font-semibold text-hc-ink/70 dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
          Not enough guesses yet for a full distribution — you&apos;re one of the first {totalGuesses} in.
        </p>
      )}

      <div className="mt-3 flex justify-between px-1 text-xs uppercase tracking-[0.18em] text-hc-ink/65 dark:text-white/60">
        <span>{first.low.toLocaleString()}</span>
        <span className="font-bold" style={{ color: 'var(--marker-answer, #1d4ed8)' }}>{data.answer.toLocaleString()}</span>
        <span>{last.high.toLocaleString()}</span>
      </div>
    </div>
  );
}
