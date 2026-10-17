/**
 * Ambient animated gradient backdrop (Vibrant Hack Club).
 * Renders fixed, GPU-composited drifting blobs behind all content.
 * Honors reduced-motion via CSS in index.css.
 */
export function BackgroundLayer() {
  return (
    <div className="hc-bg" aria-hidden="true">
      <div
        className="blob animate-blob-drift w-72 h-72"
        style={{ top: '-4rem', left: '-4rem', background: 'linear-gradient(120deg, #ff5c8a, #ff8a5c)' }}
      />
      <div
        className="blob animate-blob-drift w-80 h-80"
        style={{ top: '10%', right: '-6rem', animationDelay: '-6s', background: 'linear-gradient(120deg, #7c5cff, #3d8bff)' }}
      />
      <div
        className="blob animate-blob-drift w-64 h-64"
        style={{ bottom: '-4rem', left: '20%', animationDelay: '-12s', background: 'linear-gradient(120deg, #ffd166, #06d6a0)' }}
      />
    </div>
  );
}
