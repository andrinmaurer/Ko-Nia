import type { Scannable } from "../game/context";
import * as cue from "./cues";
import { AudioEngine, type Bus, type Volumes } from "./engine";

type Point = { x: number; y: number; z: number };
type Recipe = (e: AudioEngine, out: AudioNode) => void;

/** What the soundscape reads from the game each frame. */
export interface SoundState {
  region: string;
  listener: Point;
  forward: Point;
  robot: Point;
  /** Horizontal speed, m/s. */
  speed: number;
  grounded: boolean;
  wading: boolean;
  /** Hovering, gliding or grappling. */
  airborneMotor: boolean;
  /** 0 (night) to 1 (full day). */
  daylight: number;
  wind: number;
  energy: number;
}

/** Mix of the ambient layers and the reverb for each block. Unknown blocks use the default. */
interface Profile {
  wind: number;
  leaves: number;
  water: number;
  hum: number;
  reverb: number;
  birds: number;
  drips: number;
}

const PROFILES: Record<string, Profile> = {
  street: { wind: 0.5, leaves: 0.16, water: 0.05, hum: 0, reverb: 0.12, birds: 1, drips: 0.6 },
  temple: { wind: 0.45, leaves: 0.34, water: 0.14, hum: 0, reverb: 0.2, birds: 1.2, drips: 0.3 },
  arcade: { wind: 0.28, leaves: 0.06, water: 0.5, hum: 0, reverb: 0.38, birds: 0.5, drips: 1.5 },
  // Underground blocks: little wind, a low hum, long echoes.
  station: { wind: 0.08, leaves: 0, water: 0.12, hum: 0.5, reverb: 0.55, birds: 0, drips: 2 },
};
const DEFAULT_PROFILE = PROFILES.street;

/**
 * Sounds tied to the captions creatures already show. The caption is the
 * subtitle; the recipe plays at the nearest individual of `entry`.
 */
const CAPTION_CUES: { match: RegExp; entry?: string; play: Recipe[]; bus?: Bus }[] = [
  { match: /Hookbill caws/, entry: "hookbill", play: [cue.caw, cue.wingFlaps] },
  { match: /scratches inside the drain/, entry: "drainback", play: [cue.scratch] },
  { match: /Drainback scurries/, entry: "drainback", play: [cue.scurry] },
  { match: /whistling chord/, entry: "choir-moss", play: [cue.choirChord] },
  { match: /soft pop/, entry: "censer-puffball", play: [cue.pop] },
  { match: /sharp hiss/, entry: "censer-puffball", play: [cue.hiss] },
  { match: /splash, and a heron/, entry: "wader-heron", play: [cue.splash] },
  { match: /indignant croak/, entry: "wader-heron", play: [cue.wingFlaps, cue.croak] },
  { match: /dry rattling/, entry: "vault-mantis", play: [cue.rattle] },
  { match: /Ripples spread/, entry: "gilded-carp", play: [cue.bloop] },
  { match: /Something long is moving/, entry: "snapping-eel", play: [cue.swirl] },
  { match: /SNAP!/, play: [cue.snap] },
  { match: /Too deep/, play: [cue.strain] },
  { match: /offering box/, entry: "moss-tanuki", play: [cue.scratch, cue.chuff] },
];

/** Occasional calls from animals nearby, so the city feels inhabited between events. */
const IDLE_CALLS: { entry: string; when: "day" | "night" | "any"; every: [number, number]; play: Recipe }[] = [
  { entry: "hookbill", when: "day", every: [18, 40], play: cue.caw },
  { entry: "wader-heron", when: "day", every: [40, 90], play: cue.croak },
  { entry: "gilded-carp", when: "any", every: [25, 60], play: cue.bloop },
  { entry: "mudskipper-shoal", when: "day", every: [8, 20], play: cue.plop },
  { entry: "moss-tanuki", when: "night", every: [25, 50], play: cue.chuff },
  { entry: "drainback", when: "any", every: [30, 70], play: cue.scratch },
];

const HEARING_RANGE = 35;
const STRIDE_WALK = 0.75;

export class Soundscape {
  private engine: AudioEngine | undefined;
  private layers: { wind: GainNode; windFilter: BiquadFilterNode; leaves: GainNode; water: GainNode; hum: GainNode; crickets: GainNode; motor: GainNode; servo: GainNode; servoOsc: OscillatorNode } | undefined;
  private volumes: Volumes;
  private stride = 0;
  private wasGrounded = true;
  private lowWarned = false;
  private readonly idleTimers = IDLE_CALLS.map((c) => rand(...c.every) * 0.5);
  private birdTimer = 4;
  private dripTimer = 3;
  private creakTimer = 20;
  private musicTimer = 25;
  private profile = DEFAULT_PROFILE;
  private last: SoundState | undefined;

  constructor(private readonly scannables: () => Scannable[], volumes: Volumes) {
    this.volumes = volumes;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.engine?.suspend();
      else this.engine?.resume();
    });
  }

  /** Call from a click or key press: browsers only allow audio after one. */
  start(): void {
    if (!this.engine) {
      try {
        this.engine = new AudioEngine();
      } catch {
        return; // No Web Audio: the game stays silent and keeps its captions.
      }
      this.engine.setVolumes(this.volumes);
      this.buildLayers();
    }
    this.engine.resume();
  }

  setVolumes(v: Volumes): void {
    this.volumes = v;
    this.engine?.setVolumes(v);
  }

  /** Plays a recipe, at a world position or straight into the bus. */
  play(recipe: Recipe, at?: Point, bus: Bus = "effects", seconds = 3, wet = 1): void {
    const e = this.engine;
    if (!e || e.ctx.state !== "running") return;
    recipe(e, e.output(bus, at, seconds, wet));
  }

  /** A creature caption was shown: play its sound at the nearest individual. */
  caption(text: string): void {
    const c = CAPTION_CUES.find((x) => x.match.test(text));
    if (!c) return;
    const at = c.entry ? this.nearest(c.entry, 80)?.getPosition() : undefined;
    const pos = at ?? this.last?.robot;
    for (const r of c.play) this.play(r, pos, c.bus ?? "effects", 7);
  }

  /** Discovery and relay toasts. */
  toast(title: string): void {
    const r =
      title === "Logbook entry created" ? cue.entryCreated
      : title === "Entry complete" ? cue.entryComplete
      : title === "Location recorded" ? cue.placeRecorded
      : title.startsWith("Relay Station") ? cue.relayChime
      : title === "Systems online" ? cue.lensOn
      : cue.fieldLearned;
    this.play(r, undefined, "effects", 3, 0.4);
  }

  update(dt: number, s: SoundState): void {
    this.last = s;
    const e = this.engine;
    if (!e || !this.layers || e.ctx.state !== "running") return;
    e.setListener(s.listener, s.forward);
    const t = e.now;
    const L = this.layers;
    this.profile = PROFILES[s.region] ?? DEFAULT_PROFILE;
    const p = this.profile;
    const night = 1 - s.daylight;

    // Ambient layers ease towards the block's mix.
    L.wind.gain.setTargetAtTime(p.wind * (0.35 + s.wind * 0.9), t, 1.5);
    L.windFilter.frequency.setTargetAtTime(280 + s.wind * 900, t, 1);
    L.leaves.gain.setTargetAtTime(p.leaves * (0.5 + s.wind), t, 1.5);
    L.water.gain.setTargetAtTime(p.water, t, 2);
    L.hum.gain.setTargetAtTime(p.hum * 0.05, t, 2);
    L.crickets.gain.setTargetAtTime(night > 0.5 && p.leaves > 0.1 ? 0.012 * (night - 0.5) * 2 : 0, t, 3);
    e.reverbSend.gain.setTargetAtTime(p.reverb, t, 2);

    // Robot: footsteps, landings, servos and the hover / glide motor.
    if (s.grounded && s.speed > 0.3) {
      this.stride += s.speed * dt;
      const stride = s.speed > 5 ? STRIDE_WALK * 1.4 : STRIDE_WALK;
      if (this.stride >= stride) {
        this.stride = 0;
        this.play(s.wading ? cue.wadeStep : cue.footstep, { x: s.robot.x, y: s.robot.y, z: s.robot.z }, "effects", 1, 0.5);
      }
    }
    if (s.grounded && !this.wasGrounded) this.play(cue.land, s.robot, "effects", 1, 0.5);
    this.wasGrounded = s.grounded;
    L.servo.gain.setTargetAtTime(s.grounded && s.speed > 0.3 ? 0.006 + Math.min(s.speed, 8) * 0.0012 : 0, t, 0.15);
    L.servoOsc.frequency.setTargetAtTime(95 + s.speed * 9, t, 0.2);
    L.motor.gain.setTargetAtTime(s.airborneMotor ? 0.14 : 0, t, 0.12);
    if (s.energy < 0.2 && !this.lowWarned) {
      this.lowWarned = true;
      this.play(cue.lowEnergy, undefined, "effects", 1, 0);
    }
    if (s.energy > 0.3) this.lowWarned = false;

    // The city: birds by day, drips, creaks, and the animals nearby.
    if ((this.birdTimer -= dt) <= 0) {
      this.birdTimer = rand(4, 12) / Math.max(0.2, p.birds);
      if (s.daylight > 0.4 && p.birds > 0) this.play(cue.birdChirp, around(s.robot, 18, 25, 4, 12), "ambience");
    }
    if ((this.dripTimer -= dt) <= 0) {
      this.dripTimer = rand(2, 7) / Math.max(0.1, p.drips);
      if (p.drips > 0) this.play(cue.drip, around(s.robot, 3, 12, 0, 4), "ambience");
    }
    if ((this.creakTimer -= dt) <= 0) {
      this.creakTimer = rand(25, 60);
      this.play(cue.creak, around(s.robot, 10, 25, 2, 10), "ambience", 2);
    }
    IDLE_CALLS.forEach((c, i) => {
      if ((this.idleTimers[i] -= dt) > 0) return;
      this.idleTimers[i] = rand(...c.every);
      if ((c.when === "day" && s.daylight < 0.4) || (c.when === "night" && s.daylight > 0.3)) return;
      const who = this.nearest(c.entry, HEARING_RANGE);
      if (who) this.play(c.play, who.getPosition(), "effects", 2);
    });

    // Music: rare, slow swells with a few bell notes. Silent most of the time.
    if ((this.musicTimer -= dt) <= 0) {
      this.musicTimer = rand(70, 150);
      this.music(night);
    }
  }

  private nearest(entry: string, range: number): Scannable | undefined {
    const r = this.last?.robot;
    if (!r) return undefined;
    let best: Scannable | undefined;
    let bestD = range;
    for (const s of this.scannables()) {
      if (s.entryId !== entry || !(s.isAvailable?.() ?? true) || !s.meshes.some((m) => m.isEnabled())) continue;
      const p = s.getPosition();
      const d = Math.hypot(p.x - r.x, p.y - r.y, p.z - r.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private buildLayers(): void {
    const e = this.engine!;
    const amb = e.bus("ambience");
    const windFilter = e.filter("lowpass", 400);
    const wind = e.gain(0, amb);
    e.noiseLoop("brown").connect(windFilter).connect(wind);

    const leaves = e.gain(0, amb);
    const leafFilter = e.filter("bandpass", 2600, 0.6);
    e.noiseLoop("pink").connect(leafFilter).connect(e.gain(0.6, leaves));
    // Rustle: the leaves come and go.
    lfo(e, 0.23, 0.35, leaves);

    const water = e.gain(0, amb);
    const waterFilter = e.filter("lowpass", 650);
    e.noiseLoop("brown").connect(waterFilter).connect(water);
    lfo(e, 0.4, 0.2, water);
    const lap = e.filter("bandpass", 1400, 4);
    e.noiseLoop("white").connect(lap).connect(e.gain(0.03, water));

    const hum = e.gain(0, amb);
    for (const f of [55, 82.4]) {
      const o = e.ctx.createOscillator();
      o.frequency.value = f;
      o.connect(hum);
      o.start();
    }

    // Night insects: a 4.4 kHz tone chirped by a fast pulse and a slow gate.
    const crickets = e.gain(0, amb);
    const cricket = e.ctx.createOscillator();
    cricket.frequency.value = 4400;
    // Each gain sits at 0.5 and a square wave swings it between 0 and 1.
    const pulsed = e.gain(0.5);
    const gated = e.gain(0.5);
    cricket.connect(pulsed).connect(gated).connect(crickets);
    cricket.start();
    for (const [rate, target] of [[28, pulsed.gain], [0.9, gated.gain]] as const) {
      const sq = e.ctx.createOscillator();
      sq.type = "square";
      sq.frequency.value = rate;
      sq.connect(e.gain(0.5)).connect(target);
      sq.start();
    }

    const fx = e.bus("effects");
    const servo = e.gain(0, fx);
    const servoOsc = e.ctx.createOscillator();
    servoOsc.type = "sawtooth";
    servoOsc.frequency.value = 100;
    servoOsc.connect(e.filter("bandpass", 900, 3)).connect(servo);
    servoOsc.start();

    const motor = e.gain(0, fx);
    e.noiseLoop("pink").connect(e.filter("bandpass", 700, 0.8)).connect(motor);

    this.layers = { wind, windFilter, leaves, water, hum, crickets, motor, servo, servoOsc };
  }

  /** One slow chord swell in D dorian, a little darker at night, with bell notes over it. */
  private music(night: number): void {
    const e = this.engine;
    if (!e || e.ctx.state !== "running") return;
    const chords = night > 0.5
      ? [[73.4, 110, 174.6], [65.4, 98, 155.6], [58.3, 87.3, 146.8]]
      : [[73.4, 110, 164.8], [98, 146.8, 220], [87.3, 130.8, 196]];
    const chord = chords[Math.floor(Math.random() * chords.length)];
    const out = e.output("music", undefined, 16, 0.8);
    const pad = e.filter("lowpass", 700);
    pad.connect(out);
    for (const f of chord) {
      for (const detune of [-6, 6]) {
        e.tone(pad, { type: "triangle", freq: f, detune, attack: 5, decay: 9, peak: 0.05 });
      }
    }
    const bells = [587.3, 659.3, 784, 880, 987.8, 1174.7];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = bells[Math.floor(Math.random() * bells.length)];
      e.tone(out, { freq: f, start: 3 + i * rand(1.2, 2.4), decay: 2.6, peak: 0.035 });
      e.tone(out, { freq: f * 3, start: 3 + i * rand(1.2, 2.4), decay: 1, peak: 0.006 });
    }
  }
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** A random point around `p`, between `min` and `max` metres away horizontally, `lo`–`hi` metres up. */
function around(p: Point, min: number, max: number, lo: number, hi: number): Point {
  const a = Math.random() * Math.PI * 2;
  const r = rand(min, max);
  return { x: p.x + Math.cos(a) * r, y: p.y + rand(lo, hi), z: p.z + Math.sin(a) * r };
}

/**
 * Slow wobble: inserts a gain after `node`'s output that swings by ±`depth`
 * around 1, so it scales whatever level the layer is set to.
 */
function lfo(e: AudioEngine, rate: number, depth: number, node: GainNode): void {
  const out = (node as unknown as { __wobble?: GainNode }).__wobble ?? e.gain(1);
  node.disconnect();
  node.connect(out).connect(e.bus("ambience"));
  const o = e.ctx.createOscillator();
  o.frequency.value = rate;
  o.connect(e.gain(depth)).connect(out.gain);
  o.start();
}
