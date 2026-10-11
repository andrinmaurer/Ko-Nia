/**
 * Player settings. Stored apart from the game save, so "New game" keeps them.
 */
export interface Settings {
  /** Multiplies mouse look speed. */
  lookSpeed: number;
  invertLook: boolean;
  /** Vertical field of view in degrees. */
  fov: number;
  /** "auto" lets the game trade detail for frame rate; 1–5 pins a level (5 = highest). */
  quality: "auto" | 1 | 2 | 3 | 4 | 5;
  sprint: "hold" | "toggle";
  /** Interface scale in percent. */
  textSize: 90 | 100 | 115 | 130;
  reducedMotion: boolean;
  showFps: boolean;
  /** Volumes, 0–1. */
  volume: number;
  ambience: number;
  effects: number;
  music: number;
  /** Show captions for sounds (creature calls, warnings). */
  subtitles: boolean;
}

const KEY = "konia.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  lookSpeed: 1,
  invertLook: false,
  fov: 60,
  quality: "auto",
  sprint: "hold",
  textSize: 100,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  showFps: true,
  volume: 0.8,
  ambience: 0.8,
  effects: 0.8,
  music: 0.6,
  subtitles: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: settings last for this session only.
  }
}
