function Chalkboard() {
  return (
    <svg viewBox="0 0 260 190" className="w-full" role="img" aria-label="Chalkboard sketch of Fermi estimation formulas">
      <rect width="260" height="190" rx="10" fill="#1a1f2b" />
      <g fill="none" stroke="#f4d53b" strokeWidth="1.4" strokeLinecap="round">
        <path d="M158 44 L158 126" />
        <path d="M126 126 L190 126" />
        <path d="M158 44 L126 126" />
        <path d="M158 44 L190 126" />
      </g>
      <g fill="#f4d53b" fontFamily="Georgia, serif" fontStyle="italic" fontSize="12">
        <text x="162" y="60">ℓ</text>
        <text x="194" y="90">d</text>
        <text x="112" y="142">A</text>
        <text x="24" y="32">my goal</text>
      </g>
      <g fill="#ede9e0" fontFamily="Georgia, serif" fontStyle="italic" fontSize="13">
        <text x="24" y="64">N = A / (2πdℓ)</text>
        <text x="24" y="90">⇒ N ≈ 10⁶</text>
        <text x="24" y="128">π ≈ 3.14</text>
        <text x="24" y="152">ℓ ≈ 10 m</text>
      </g>
    </svg>
  );
}

export function WhatIsGuessIt() {
  return (
    <section aria-labelledby="what-is-guess-it" className="shell-wide pb-16 sm:pb-24">
      <h2 id="what-is-guess-it" className="text-center font-display text-3xl font-extrabold sm:text-4xl">
        What is a <span className="highlight-mark">Guess It</span> question?
      </h2>

      <div className="card mt-10 grid items-center gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <p className="text-sm leading-7 sm:text-base">
          Guess It! is a daily game built on the famous &ldquo;Fermi estimation&rdquo; technique: use quick math and rough
          guesses to get close to numbers nobody can look up. The physicist who popularised the concept, Enrico Fermi,
          famously estimated the strength of an atomic bomb from how far paper scraps flew from his hand. Every day you
          get three questions to guess at, then see how you compare to everyone else. Good luck!
        </p>
        <Chalkboard />
      </div>
    </section>
  );
}