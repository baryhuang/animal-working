export type Sfx = 'blip' | 'ok' | 'pickup';

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx!;
}

function makeOsc(type: OscillatorType, freq: number, duration: number, volume = 0.2): void {
  const audio = ensureCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export function sfx(name: Sfx): void {
  switch (name) {
    case 'blip':
      makeOsc('square', 880, 0.06, 0.12);
      break;
    case 'ok':
      makeOsc('triangle', 660, 0.12, 0.18);
      setTimeout(() => makeOsc('triangle', 990, 0.12, 0.18), 90);
      break;
    case 'pickup':
      makeOsc('sawtooth', 740, 0.08, 0.18);
      break;
  }
}

export function startBGM(): void {
  const audio = ensureCtx();
  const o1 = audio.createOscillator();
  const g1 = audio.createGain();
  o1.type = 'square';
  o1.frequency.value = 220;
  g1.gain.value = 0.04;
  o1.connect(g1).connect(audio.destination);
  o1.start();
}


