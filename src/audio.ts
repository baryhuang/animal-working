export type Sfx = 'blip' | 'ok' | 'pickup' | 'talk' | 'check' | 'step';

let ctx: AudioContext | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;

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

function blipSeq(freqs: number[], dur = 0.06, vol = 0.1, gap = 40): void {
  freqs.forEach((f, i) => setTimeout(() => makeOsc('triangle', f, dur, vol), i * gap));
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
    case 'talk':
      blipSeq([660, 880, 760, 920], 0.04, 0.08, 35);
      break;
    case 'check':
      blipSeq([520, 780], 0.06, 0.14, 80);
      break;
    case 'step':
      makeOsc('triangle', 220, 0.03, 0.06);
      break;
  }
}

export async function startBGMFromUrl(url: string, volume = 0.16, fadeMs = 600): Promise<void> {
  const audio = ensureCtx();
  // Stop previous
  if (bgmSource) {
    try { bgmSource.stop(); } catch {}
  }
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  const buf = await audio.decodeAudioData(arr);
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = buf;
  source.loop = true;
  gain.gain.value = 0;
  source.connect(gain).connect(audio.destination);
  source.start();
  // Fade in
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + fadeMs / 1000);
  bgmSource = source;
  bgmGain = gain;
}

export function stopBGM(fadeMs = 400): void {
  if (!ctx || !bgmSource || !bgmGain) return;
  const now = ctx.currentTime;
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
  bgmGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  setTimeout(() => {
    try { bgmSource?.stop(); } catch {}
    bgmSource = null;
    bgmGain = null;
  }, fadeMs + 50);
}


