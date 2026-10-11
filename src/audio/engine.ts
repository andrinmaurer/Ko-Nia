/**
 * Small Web Audio engine. Every sound in the game is synthesised here from
 * oscillators and filtered noise, so there are no audio files to download or
 * license. Four buses (ambience, effects, music, master) carry the volume
 * settings; a shared reverb gives each block its sense of space.
 */

export type Bus = "ambience" | "effects" | "music";

export interface Volumes {
  master: number;
  ambience: number;
  effects: number;
  music: number;
}

type Point = { x: number; y: number; z: number };

export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly buses: Record<Bus, GainNode>;
  /** Send into the shared reverb; its level changes per block. */
  readonly reverbSend: GainNode;
  readonly noise: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer };

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: "playback" });
    this.master = this.ctx.createGain();
    // A gentle limiter so overlapping cues never clip.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.buses = {
      ambience: this.gain(1, this.master),
      effects: this.gain(1, this.master),
      music: this.gain(1, this.master),
    };
    const reverb = this.ctx.createConvolver();
    reverb.buffer = this.impulse(2.2);
    this.reverbSend = this.gain(0.2);
    this.reverbSend.connect(reverb).connect(this.master);
    this.noise = { white: this.noiseBuffer("white"), pink: this.noiseBuffer("pink"), brown: this.noiseBuffer("brown") };
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Browsers start audio suspended until a click or key press. */
  resume(): void {
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx.state === "running") void this.ctx.suspend();
  }

  setVolumes(v: Volumes): void {
    const t = this.now;
    // Perceived loudness is roughly logarithmic: square the slider value.
    this.master.gain.setTargetAtTime(v.master ** 2, t, 0.05);
    this.buses.ambience.gain.setTargetAtTime(v.ambience ** 2, t, 0.05);
    this.buses.effects.gain.setTargetAtTime(v.effects ** 2, t, 0.05);
    this.buses.music.gain.setTargetAtTime(v.music ** 2, t, 0.05);
  }

  bus(name: Bus): GainNode {
    return this.buses[name];
  }

  gain(value: number, to?: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  }

  filter(type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  /** Looping noise source, started now. */
  noiseLoop(kind: keyof AudioEngine["noise"]): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[kind];
    src.loop = true;
    // Start somewhere random so layers using the same buffer don't phase.
    src.start(0, Math.random() * src.buffer.duration);
    return src;
  }

  /**
   * Output for a one-shot sound: a panner at `at` (or straight to the bus when
   * omitted), plus a reverb send. Nodes are dropped when `seconds` have passed.
   */
  output(bus: Bus, at?: Point, seconds = 3, wet = 1): AudioNode {
    const dry = this.gain(1);
    let tail: AudioNode = dry;
    if (at) {
      const p = this.ctx.createPanner();
      p.panningModel = "equalpower";
      p.distanceModel = "inverse";
      p.refDistance = 3;
      p.rolloffFactor = 1.2;
      p.maxDistance = 80;
      setPosition(p, at);
      dry.connect(p);
      tail = p;
    }
    tail.connect(this.buses[bus]);
    if (wet > 0) {
      const send = this.gain(wet, this.reverbSend);
      tail.connect(send);
      setTimeout(() => send.disconnect(), (seconds + 3) * 1000);
    }
    setTimeout(() => tail.disconnect(), (seconds + 3) * 1000);
    return dry;
  }

  /** Oscillator note with an attack/decay envelope. */
  tone(
    out: AudioNode,
    opts: { type?: OscillatorType; freq: number; toFreq?: number; start?: number; attack?: number; decay: number; peak?: number; detune?: number },
  ): void {
    const t = this.now + (opts.start ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.toFreq) osc.frequency.exponentialRampToValueAtTime(opts.toFreq, t + (opts.attack ?? 0.01) + opts.decay);
    if (opts.detune) osc.detune.value = opts.detune;
    const env = this.envelope(t, opts.attack ?? 0.01, opts.decay, opts.peak ?? 0.3);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + (opts.attack ?? 0.01) + opts.decay + 0.05);
  }

  /** Filtered noise burst with an attack/decay envelope. */
  burst(
    out: AudioNode,
    opts: { kind?: keyof AudioEngine["noise"]; type?: BiquadFilterType; freq: number; toFreq?: number; q?: number; start?: number; attack?: number; decay: number; peak?: number },
  ): void {
    const t = this.now + (opts.start ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[opts.kind ?? "white"];
    const f = this.filter(opts.type ?? "bandpass", opts.freq, opts.q ?? 1);
    if (opts.toFreq) f.frequency.exponentialRampToValueAtTime(opts.toFreq, t + (opts.attack ?? 0.005) + opts.decay);
    const env = this.envelope(t, opts.attack ?? 0.005, opts.decay, opts.peak ?? 0.3);
    src.connect(f).connect(env).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + (opts.attack ?? 0.005) + opts.decay + 0.05);
  }

  setListener(pos: Point, forward: Point): void {
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.now;
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(forward.x, t);
      l.forwardY.setValueAtTime(forward.y, t);
      l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  private envelope(t: number, attack: number, decay: number, peak: number): GainNode {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return env;
  }

  private noiseBuffer(kind: "white" | "pink" | "brown"): AudioBuffer {
    const length = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  /** Synthetic room impulse: decaying stereo noise. */
  private impulse(seconds: number): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buf;
  }
}

function setPosition(p: PannerNode, at: Point): void {
  if (p.positionX) {
    p.positionX.value = at.x;
    p.positionY.value = at.y;
    p.positionZ.value = at.z;
  } else {
    p.setPosition(at.x, at.y, at.z);
  }
}
