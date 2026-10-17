let muted = typeof localStorage !== 'undefined' && localStorage.getItem('guessit-muted') === 'true';

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function unlock() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('guessit-muted', value.toString());
  }
}

export function isMuted(): boolean {
  return muted;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  if (muted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

export function playClick() {
  playTone(800, 0.05);
}

export function playChime() {
  playTone(523, 0.15);
  setTimeout(() => playTone(659, 0.15), 100);
  setTimeout(() => playTone(784, 0.2), 200);
}

export function playTick() {
  playTone(1000, 0.03, 'square');
}
