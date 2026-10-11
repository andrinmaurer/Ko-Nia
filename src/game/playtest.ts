import { ENTRIES, ENTRY_BY_ID, stepsFor } from "../discovery/entries";
import type { Logbook } from "../discovery/logbook";

/**
 * Playtest recorder. Measures the MVP success criteria from
 * 17_MVP_SPECIFICATION.md while someone plays: time to the first Logbook entry,
 * behavior observations, lowest frame rate, disables. Nothing leaves the
 * browser; the tester copies the report from the pause menu and sends it.
 */

const STORE_KEY = "konia.playtest.v1";

interface Event {
  /** Seconds of play time (paused time and the Logbook screen don't count). */
  t: number;
  what: string;
}

interface Session {
  startedAt: string;
  newPlayer: boolean;
  playSeconds: number;
  firstEntryAt?: number;
  firstObservationAt?: number;
  firstLogbookAt?: number;
  scans: number;
  logbookOpens: number;
  disables: number;
  /** Lowest 5-second average frame rate while playing. */
  fpsLow?: number;
  fpsSum: number;
  fpsSamples: number;
  lowestQuality: string;
  events: Event[];
}

export class Playtest {
  private readonly session: Session;
  private known = new Map<string, { discovered: boolean; bio: boolean; observed: boolean; complete: boolean }>();
  private frames = 0;
  private frameTime = 0;
  private window: number[] = [];
  private saveTimer = 0;

  constructor(private readonly logbook: Logbook, newPlayer: boolean) {
    this.session = {
      startedAt: new Date().toISOString(),
      newPlayer,
      playSeconds: 0,
      scans: 0,
      logbookOpens: 0,
      disables: 0,
      fpsSum: 0,
      fpsSamples: 0,
      lowestQuality: "",
      events: [],
    };
    this.snapshot();
    logbook.onChange(() => this.diff());
  }

  /** Call every game frame while the robot is being played. */
  update(dt: number): void {
    this.session.playSeconds += dt;
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = 10;
      this.store();
    }
  }

  /** Call every rendered frame while playing, with the real (unclamped) frame time. */
  sampleFrame(realDt: number, qualityLabel: string): void {
    if (!this.session.lowestQuality || qualityLabel < this.session.lowestQuality) this.session.lowestQuality = qualityLabel;
    this.frames++;
    this.frameTime += realDt;
    if (this.frameTime >= 1) {
      const fps = this.frames / this.frameTime;
      this.frames = 0;
      this.frameTime = 0;
      this.session.fpsSum += fps;
      this.session.fpsSamples++;
      this.window.push(fps);
      if (this.window.length > 5) this.window.shift();
      // Skip the first seconds: shaders compile and quality settles.
      if (this.window.length === 5 && this.session.playSeconds > 15) {
        const avg = this.window.reduce((a, b) => a + b, 0) / 5;
        if (this.session.fpsLow === undefined || avg < this.session.fpsLow) this.session.fpsLow = avg;
      }
    }
  }

  scanned(): void {
    this.session.scans++;
  }

  logbookOpened(): void {
    this.session.logbookOpens++;
    if (this.session.firstLogbookAt === undefined) this.session.firstLogbookAt = this.session.playSeconds;
    this.log("Opened the Logbook");
  }

  disabled(): void {
    this.session.disables++;
    this.log("Robot disabled");
  }

  /** Plain-text report for the tester to paste into a message. */
  report(): string {
    const s = this.session;
    const avg = s.fpsSamples ? s.fpsSum / s.fpsSamples : undefined;
    const done = ENTRIES.filter((e) => this.logbook.isComplete(e.id)).length;
    const lines = [
      "Ko-Nia playtest report",
      `Date: ${s.startedAt.slice(0, 16).replace("T", " ")} UTC`,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
      `New player: ${s.newPlayer ? "yes" : "no (continued a save)"}`,
      `Play time: ${mmss(s.playSeconds)}`,
      `First Logbook entry: ${at(s.firstEntryAt)}  (goal: under 2:00)`,
      `First behavior observation: ${at(s.firstObservationAt)}`,
      `First time opening the Logbook: ${at(s.firstLogbookAt)}`,
      `Scans: ${s.scans} · Logbook opens: ${s.logbookOpens} · Disabled: ${s.disables}`,
      `Logbook: ${Math.round(this.logbook.completion() * 100)}% (${done}/${ENTRIES.length} entries complete)`,
      `FPS: average ${avg === undefined ? "n/a" : avg.toFixed(0)}, lowest 5 s average ${s.fpsLow === undefined ? "n/a" : s.fpsLow.toFixed(0)} (goal: 30+)`,
      `Lowest quality level used: ${s.lowestQuality || "n/a"} (Q5 is the highest)`,
      "",
      "Timeline:",
      ...s.events.map((e) => `  ${mmss(e.t)}  ${e.what}`),
    ];
    return lines.join("\n");
  }

  private log(what: string): void {
    this.session.events.push({ t: this.session.playSeconds, what });
    if (this.session.events.length > 200) this.session.events.shift();
    this.store();
  }

  private snapshot(): void {
    for (const e of ENTRIES) {
      const p = this.logbook.get(e.id);
      this.known.set(e.id, { discovered: p.discovered, bio: p.bio, observed: p.observed, complete: this.logbook.isComplete(e.id) });
    }
  }

  /** Turns Logbook changes into timeline events. */
  private diff(): void {
    for (const e of ENTRIES) {
      const p = this.logbook.get(e.id);
      const before = this.known.get(e.id)!;
      const name = ENTRY_BY_ID.get(e.id)!.name;
      if (p.discovered && !before.discovered) {
        if (this.session.firstEntryAt === undefined) this.session.firstEntryAt = this.session.playSeconds;
        this.log(`New entry: ${name}`);
      }
      if (p.bio && !before.bio) this.log(`Biological scan: ${name}`);
      if (p.observed && !before.observed) {
        if (this.session.firstObservationAt === undefined) this.session.firstObservationAt = this.session.playSeconds;
        this.log(`Observed behavior: ${name}`);
      }
      if (stepsFor(e) === 3 && this.logbook.isComplete(e.id) && !before.complete) this.log(`Completed: ${name}`);
    }
    this.snapshot();
  }

  private store(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.session));
    } catch {
      // Storage unavailable: the report still works for this session.
    }
  }
}

function mmss(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function at(seconds: number | undefined): string {
  return seconds === undefined ? "not yet" : mmss(seconds);
}
