import type { AudioEngine } from "./engine";

/**
 * Sound recipes. Each one plays into `out`, an output from `AudioEngine.output`
 * (positioned in the world, or not).
 */
type Recipe = (e: AudioEngine, out: AudioNode) => void;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// --- Robot ---------------------------------------------------------------------

export const footstep: Recipe = (e, out) => {
  e.burst(out, { kind: "brown", type: "lowpass", freq: rand(260, 340), decay: 0.09, peak: 0.35 });
  e.tone(out, { freq: rand(68, 80), toFreq: 45, decay: 0.07, peak: 0.18 });
  // A faint metallic tick from the foot joint.
  e.tone(out, { type: "triangle", freq: rand(1900, 2300), decay: 0.03, peak: 0.012 });
};

export const wadeStep: Recipe = (e, out) => {
  e.burst(out, { type: "bandpass", freq: rand(800, 1000), toFreq: 350, q: 0.8, decay: 0.3, peak: 0.22 });
  e.burst(out, { kind: "brown", type: "lowpass", freq: 400, decay: 0.15, peak: 0.2 });
};

export const land: Recipe = (e, out) => {
  e.burst(out, { kind: "brown", type: "lowpass", freq: 420, decay: 0.2, peak: 0.6 });
  e.tone(out, { freq: 70, toFreq: 38, decay: 0.18, peak: 0.3 });
  e.tone(out, { type: "triangle", freq: 410, decay: 0.25, peak: 0.02 });
};

export const hit: Recipe = (e, out) => {
  e.burst(out, { kind: "brown", type: "lowpass", freq: 500, decay: 0.35, peak: 0.7 });
  e.tone(out, { type: "square", freq: 150, toFreq: 55, decay: 0.25, peak: 0.07 });
  e.tone(out, { type: "triangle", freq: 523, decay: 0.6, peak: 0.05 });
  e.tone(out, { type: "triangle", freq: 787, decay: 0.45, peak: 0.035 });
};

export const lowEnergy: Recipe = (e, out) => {
  e.tone(out, { freq: 880, decay: 0.09, peak: 0.06 });
  e.tone(out, { freq: 660, start: 0.16, decay: 0.12, peak: 0.06 });
};

// --- Scanner and interface ---------------------------------------------------------

export const lensOn: Recipe = (e, out) => {
  e.tone(out, { freq: 520, toFreq: 1240, attack: 0.02, decay: 0.16, peak: 0.07 });
  e.burst(out, { type: "highpass", freq: 6000, decay: 0.12, peak: 0.03 });
};

export const lensOff: Recipe = (e, out) => {
  e.tone(out, { freq: 1100, toFreq: 480, attack: 0.02, decay: 0.14, peak: 0.05 });
};

export const targetTick: Recipe = (e, out) => {
  e.tone(out, { freq: 1760, decay: 0.05, peak: 0.035 });
};

export const modeTick: Recipe = (e, out) => {
  e.tone(out, { type: "triangle", freq: 1320, decay: 0.04, peak: 0.04 });
  e.tone(out, { type: "triangle", freq: 990, start: 0.05, decay: 0.05, peak: 0.03 });
};

export const shutter: Recipe = (e, out) => {
  e.burst(out, { type: "highpass", freq: 3200, decay: 0.035, peak: 0.3 });
  e.burst(out, { type: "bandpass", freq: 1800, q: 2, start: 0.07, decay: 0.03, peak: 0.18 });
  e.tone(out, { freq: 2400, toFreq: 1600, start: 0.02, decay: 0.08, peak: 0.02 });
};

export const denied: Recipe = (e, out) => {
  e.tone(out, { freq: 240, decay: 0.14, peak: 0.05 });
};

/** Discovery chimes: calm, a little higher for each step of a page. */
export const chime = (notes: number[], spacing = 0.13, decay = 1.1): Recipe => (e, out) => {
  notes.forEach((f, i) => {
    e.tone(out, { type: "triangle", freq: f, start: i * spacing, decay, peak: 0.07 });
    e.tone(out, { freq: f * 2, start: i * spacing, decay: decay * 0.6, peak: 0.015 });
  });
};

export const entryCreated = chime([659.3, 987.8]);
export const fieldLearned = chime([784, 1174.7]);
export const entryComplete = chime([523.3, 659.3, 784, 1046.5], 0.16, 1.8);
export const placeRecorded = chime([880], 0, 0.9);
export const relayChime = chime([392, 523.3, 784], 0.11, 1.2);

export const transmission: Recipe = (e, out) => {
  e.burst(out, { type: "bandpass", freq: 2200, q: 0.6, attack: 0.1, decay: 1.4, peak: 0.05 });
  for (let i = 0; i < 7; i++) {
    e.tone(out, { type: "square", freq: rand(700, 2100), start: 0.35 + i * 0.09, decay: 0.05, peak: 0.012 });
  }
  e.tone(out, { freq: 440, start: 1.2, decay: 1.2, peak: 0.04 });
};

// --- Animals and plants --------------------------------------------------------------

export const caw: Recipe = (e, out) => {
  for (const s of [0, rand(0.3, 0.42)]) {
    const f = rand(480, 560);
    e.tone(out, { type: "sawtooth", freq: f, toFreq: f * 0.72, start: s, attack: 0.02, decay: 0.22, peak: 0.12 });
    e.burst(out, { type: "bandpass", freq: 1400, q: 3, start: s, decay: 0.2, peak: 0.08 });
  }
};

export const wingFlaps: Recipe = (e, out) => {
  for (let i = 0; i < 7; i++) e.burst(out, { kind: "pink", type: "lowpass", freq: 700, start: i * 0.1, decay: 0.07, peak: 0.25 });
};

export const scratch: Recipe = (e, out) => {
  let t = 0;
  for (let i = 0; i < 9; i++) {
    t += rand(0.04, 0.14);
    e.burst(out, { type: "bandpass", freq: rand(3200, 5200), q: 2, start: t, decay: 0.03, peak: 0.18 });
  }
};

export const scurry: Recipe = (e, out) => {
  for (let i = 0; i < 12; i++) e.burst(out, { type: "highpass", freq: 2400, start: i * 0.05, decay: 0.02, peak: 0.14 });
  e.burst(out, { kind: "brown", type: "lowpass", freq: 300, start: 0.6, decay: 0.2, peak: 0.25 });
};

/** Choir Moss: a soft, breathy open chord that swells with the gust. */
export const choirChord: Recipe = (e, out) => {
  for (const [i, f] of [392, 587.3, 880, 1318.5].entries()) {
    e.tone(out, { freq: f, start: i * 0.25, attack: 1.4, decay: 4.5, peak: 0.045 });
    e.burst(out, { kind: "pink", type: "bandpass", freq: f, q: 40, start: i * 0.25, attack: 1.2, decay: 4.2, peak: 0.25 });
  }
};

export const pop: Recipe = (e, out) => {
  e.tone(out, { freq: 320, toFreq: 70, decay: 0.09, peak: 0.35 });
  e.burst(out, { kind: "pink", type: "lowpass", freq: 900, decay: 0.6, attack: 0.02, peak: 0.12 });
};

export const hiss: Recipe = (e, out) => {
  e.burst(out, { type: "highpass", freq: 4500, attack: 0.35, decay: 1.2, peak: 0.16 });
};

export const splash: Recipe = (e, out) => {
  e.burst(out, { type: "bandpass", freq: 1400, toFreq: 280, q: 0.7, decay: 0.55, peak: 0.4 });
  for (let i = 0; i < 6; i++) e.tone(out, { freq: rand(1400, 2600), start: rand(0.05, 0.5), decay: 0.05, peak: 0.04 });
};

export const croak: Recipe = (e, out) => {
  for (const s of [0, 0.42]) {
    e.tone(out, { type: "sawtooth", freq: 170, toFreq: 118, start: s, attack: 0.03, decay: 0.32, peak: 0.12 });
    e.burst(out, { type: "bandpass", freq: 650, q: 3, start: s, decay: 0.3, peak: 0.1 });
  }
};

/** Vault Mantis warning: a dry, fast wing rattle. */
export const rattle: Recipe = (e, out) => {
  for (let i = 0; i < 30; i++) {
    e.burst(out, { type: "bandpass", freq: rand(3000, 4200), q: 3, start: i * 0.032 + (i >= 15 ? 0.25 : 0), decay: 0.016, peak: 0.35 });
  }
};

export const bloop: Recipe = (e, out) => {
  e.tone(out, { freq: 210, toFreq: 420, decay: 0.14, peak: 0.12 });
  e.burst(out, { kind: "pink", type: "lowpass", freq: 700, start: 0.04, decay: 0.3, peak: 0.08 });
};

export const plop: Recipe = (e, out) => {
  e.tone(out, { freq: rand(650, 800), toFreq: 280, decay: 0.07, peak: 0.08 });
};

export const swirl: Recipe = (e, out) => {
  e.burst(out, { kind: "brown", type: "lowpass", freq: 320, toFreq: 140, attack: 0.5, decay: 1.6, peak: 0.45 });
  e.burst(out, { type: "bandpass", freq: 700, q: 2, attack: 0.4, decay: 1.2, peak: 0.05 });
};

export const snap: Recipe = (e, out) => {
  e.burst(out, { type: "highpass", freq: 1500, decay: 0.06, peak: 0.6 });
  e.tone(out, { type: "square", freq: 95, toFreq: 40, decay: 0.16, peak: 0.15 });
  splash(e, out);
};

export const strain: Recipe = (e, out) => {
  splash(e, out);
  e.tone(out, { type: "sawtooth", freq: 210, toFreq: 120, start: 0.2, attack: 0.1, decay: 0.6, peak: 0.03 });
};

export const chuff: Recipe = (e, out) => {
  for (const s of [0, 0.22]) e.burst(out, { kind: "pink", type: "bandpass", freq: 520, q: 1.5, start: s, decay: 0.12, peak: 0.25 });
};

export const birdChirp: Recipe = (e, out) => {
  const n = 2 + Math.floor(Math.random() * 3);
  const base = rand(2600, 3600);
  for (let i = 0; i < n; i++) e.tone(out, { freq: base, toFreq: base * rand(1.15, 1.4), start: i * rand(0.09, 0.14), decay: 0.07, peak: 0.035 });
};

export const drip: Recipe = (e, out) => {
  const f = rand(1100, 1700);
  e.tone(out, { freq: f, toFreq: f * 1.5, decay: 0.05, peak: 0.04 });
};

export const creak: Recipe = (e, out) => {
  e.tone(out, { type: "sawtooth", freq: rand(90, 120), toFreq: rand(70, 140), attack: 0.2, decay: 0.7, peak: 0.012 });
  e.burst(out, { type: "bandpass", freq: 900, q: 6, attack: 0.2, decay: 0.6, peak: 0.04 });
};
