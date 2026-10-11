import { ENTRIES, ENTRY_BY_ID, stepsFor } from "./entries";

export type ScanMode = "visual" | "bio";

export interface EntryProgress {
  discovered: boolean;
  bio: boolean;
  observed: boolean;
  /** JPEG data URL captured on the first scan. */
  image?: string;
  /** Location entry id where it was first scanned. */
  locationId?: string;
  /** Game time of the first scan, in hours (0–24) plus day index. */
  day?: number;
  hour?: number;
  /** Where in the block it was first scanned (world x / z). */
  x?: number;
  z?: number;
  /** Game hours of every scan, used by time-dependent observations. */
  scanHours: number[];
}

/** What a scan taught the player, in the order it should be announced. */
export type Learned = "created" | "ancestry" | "behavior" | "complete" | "nothing";

const SAVE_KEY = "konia.save.v1";

export interface SaveData {
  version: 1;
  logbook: Record<string, EntryProgress>;
  /** Shrine Street's station; kept for saves from before Temple Hill. */
  relayActivated: boolean;
  /** Ids of every activated Relay Station. */
  relays?: string[];
  /** The station the robot respawns at. */
  homeRelay?: string;
  day: number;
  hours: number;
}

/**
 * Logbook progress. Every change is saved locally right away; the format is
 * plain JSON so it can be synced to Supabase later without changes.
 */
export class Logbook {
  progress: Record<string, EntryProgress> = {};
  private listeners: (() => void)[] = [];

  constructor() {
    for (const e of ENTRIES) this.progress[e.id] = blank();
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  get(id: string): EntryProgress {
    return this.progress[id];
  }

  stepsDone(id: string): number {
    const p = this.progress[id];
    if (!p.discovered) return 0;
    if (stepsFor(ENTRY_BY_ID.get(id)!) === 1) return 1;
    return 1 + (p.bio ? 1 : 0) + (p.observed ? 1 : 0);
  }

  isComplete(id: string): boolean {
    return this.stepsDone(id) === stepsFor(ENTRY_BY_ID.get(id)!);
  }

  /** Total Logbook completion, 0–1. Every observation step counts. */
  completion(): number {
    let done = 0;
    let total = 0;
    for (const e of ENTRIES) {
      done += this.stepsDone(e.id);
      total += stepsFor(e);
    }
    return done / total;
  }

  /**
   * Records a scan and returns what was newly learned.
   * @param conditionMet whether the species' behavior observation is happening right now
   */
  recordScan(
    id: string,
    mode: ScanMode,
    conditionMet: boolean,
    when: { day: number; hour: number },
    locationId: string | undefined,
    where?: { x: number; z: number },
  ): Learned[] {
    const def = ENTRY_BY_ID.get(id)!;
    const p = this.progress[id];
    const learned: Learned[] = [];
    if (!p.discovered) {
      p.discovered = true;
      p.day = when.day;
      p.hour = when.hour;
      p.locationId = locationId;
      p.x = where?.x;
      p.z = where?.z;
      learned.push("created");
    }
    p.scanHours.push(when.hour);
    if (stepsFor(def) === 3) {
      if (mode === "bio" && !p.bio) {
        p.bio = true;
        learned.push("ancestry");
      }
      if (conditionMet && !p.observed) {
        p.observed = true;
        learned.push("behavior");
      }
    }
    if (learned.length > 0 && this.isComplete(id)) learned.push("complete");
    if (learned.length === 0) learned.push("nothing");
    this.changed();
    return learned;
  }

  /** Locations are revealed by the first scan made inside them. */
  discoverLocation(id: string, when: { day: number; hour: number }): boolean {
    const p = this.progress[id];
    if (p.discovered) return false;
    p.discovered = true;
    p.day = when.day;
    p.hour = when.hour;
    p.locationId = id;
    this.changed();
    return true;
  }

  setImage(id: string, image: string): void {
    this.progress[id].image = image;
    this.changed();
  }

  toJSON(): Record<string, EntryProgress> {
    return this.progress;
  }

  load(saved: Record<string, EntryProgress>): void {
    for (const e of ENTRIES) if (saved[e.id]) this.progress[e.id] = { ...blank(), ...saved[e.id] };
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }
}

function blank(): EntryProgress {
  return { discovered: false, bio: false, observed: false, scanHours: [] };
}

export function readSave(): SaveData | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as SaveData;
    return data.version === 1 ? data : undefined;
  } catch {
    return undefined;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode): the game keeps running without saving.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
