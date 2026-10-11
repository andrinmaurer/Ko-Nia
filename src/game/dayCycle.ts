import { Vector3 } from "@babylonjs/core";

/** One full in-game day lasts this many real seconds (60 minutes, per the design docs). */
export const DAY_LENGTH_SECONDS = 3600;

const SUNRISE = 6;
const SUNSET = 19;

export class DayCycle {
  day = 1;
  hours = 7;

  update(dt: number): void {
    this.hours += (dt * 24) / DAY_LENGTH_SECONDS;
    if (this.hours >= 24) {
      this.hours -= 24;
      this.day += 1;
    }
  }

  get isNight(): boolean {
    return this.hours < SUNRISE - 0.5 || this.hours >= SUNSET + 0.5;
  }

  /** 0 at night, 1 at midday, with half an hour of twilight on each side. */
  get daylight(): number {
    const t = (this.hours - (SUNRISE - 0.5)) / (SUNSET - SUNRISE + 1);
    if (t <= 0 || t >= 1) return 0;
    return Math.sin(Math.PI * t) ** 0.6;
  }

  /** Direction the sunlight travels. The sun rises in the east (+x) and sets in the west. */
  get sunDirection(): Vector3 {
    const t = Math.min(1, Math.max(0, (this.hours - SUNRISE) / (SUNSET - SUNRISE)));
    const angle = t * Math.PI;
    const elevation = Math.max(0.25, Math.sin(angle));
    return new Vector3(-Math.cos(angle), -elevation, 0.35).normalize();
  }

  /** Skips forward to the next occurrence of `hour`. */
  advanceTo(hour: number): void {
    if (hour <= this.hours) this.day += 1;
    this.hours = hour;
  }

  get label(): string {
    return `${inWorldDate(this.day)} · ${formatHour(this.hours)}`;
  }
}

/** In-world date for a game day, MM.DD.YYYY. Day 1 is 03.14.2147. */
export function inWorldDate(day: number): string {
  const d = new Date(Date.UTC(2147, 2, 13 + day));
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

export function formatHour(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Fictional map coordinates for a point in the block. */
export function coordinates(x: number, z: number): string {
  return `${(34.6821 + z * 0.00001).toFixed(4)}, ${(135.4962 + x * 0.00001).toFixed(4)}`;
}
