export type SoundName = 'click' | 'nav' | 'submit' | 'success' | 'error' | 'toggle';

type Note = {

  freq: number;

  at: number;

  dur: number;
  gain: number;
  type: OscillatorType;
};

const SOUNDS: Record<SoundName, readonly Note[]> = {
  click: [{ freq: 880, at: 0, dur: 0.045, gain: 0.1, type: 'sine' }],
  nav: [{ freq: 600, at: 0, dur: 0.05, gain: 0.08, type: 'sine' }],
  toggle: [{ freq: 1040, at: 0, dur: 0.03, gain: 0.09, type: 'square' }],

  submit: [
    { freq: 523, at: 0, dur: 0.075, gain: 0.1, type: 'sine' },
    { freq: 784, at: 0.055, dur: 0.085, gain: 0.1, type: 'sine' },
  ],

  success: [
    { freq: 523, at: 0, dur: 0.05, gain: 0.1, type: 'sine' },
    { freq: 659, at: 0.04, dur: 0.05, gain: 0.1, type: 'sine' },
    { freq: 784, at: 0.08, dur: 0.06, gain: 0.11, type: 'sine' },
  ],

  error: [{ freq: 150, at: 0, dur: 0.13, gain: 0.12, type: 'sine' }],
};

const THROTTLE_MS = 60;

const STORAGE_KEY = 'guessit-muted';
const INTERACTIVE = 'button, a[href], [role="button"], [role="tab"]';

let muted = false;
let installed = false;
let audioContext: AudioContext | null = null;
const lastPlayed = new Map<SoundName, number>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {

    return false;
  }
}

if (typeof localStorage !== 'undefined') muted = readMuted();

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value.toString());
  } catch {

  }
}

export function isMuted(): boolean {
  return muted;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function play(name: SoundName) {
  if (muted) return;

  const now = Date.now();
  const last = lastPlayed.get(name);
  if (last !== undefined && now - last < THROTTLE_MS) return;
  lastPlayed.set(name, now);

  const ctx = getAudioContext();
  if (!ctx) return;

  const base = ctx.currentTime;
  for (const note of SOUNDS[name]) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = base + note.at;

      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, start);

      gain.gain.setValueAtTime(note.gain, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.dur);
    } catch {

    }
  }
}

function soundNameFor(element: Element): SoundName {
  const attr = element.getAttribute('data-sound');
  return attr && attr in SOUNDS ? (attr as SoundName) : 'click';
}

function interactiveTarget(event: Event): Element | null {
  return event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
}

export function installInteractionSounds() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener(
    'pointerdown',
    (event) => {
      const element = interactiveTarget(event);
      if (element) play(soundNameFor(element));
    },
    true
  );

  document.addEventListener(
    'keydown',
    (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
      const element = interactiveTarget(event);

      if (element) play(soundNameFor(element));
    },
    true
  );
}
