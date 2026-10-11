import type { AbstractMesh, Engine, GlowLayer, ShadowGenerator } from "../babylon";

/**
 * Keeps the frame rate at or above the 30 FPS target by trading resolution and
 * effects for speed. Starts high and steps down when the average drops; steps
 * back up only after a long stretch of headroom, so it doesn't oscillate.
 */
interface Level {
  /** Render resolution as a fraction of the screen's device pixels (capped). */
  pixelRatio: number;
  /**
   * Most pixels rendered per frame, in millions. Keeps big Retina windows from
   * costing far more than small ones (Safari at 1680x837 @2x fell to ~37 FPS
   * with the ratio cap alone).
   */
  megapixels: number;
  shadowMap: number;
  glow: boolean;
  /** Fern beds, giant leaves and leaf shells: lots of cut-out overdraw. */
  detail: boolean;
}

const LEVELS: Level[] = [
  { pixelRatio: 1.5, megapixels: 2.2, shadowMap: 2048, glow: true, detail: true },
  { pixelRatio: 1.2, megapixels: 1.6, shadowMap: 2048, glow: true, detail: true },
  { pixelRatio: 1, megapixels: 1.2, shadowMap: 1024, glow: true, detail: false },
  { pixelRatio: 0.85, megapixels: 0.9, shadowMap: 1024, glow: false, detail: false },
  { pixelRatio: 0.7, megapixels: 0.6, shadowMap: 512, glow: false, detail: false },
];

const TARGET_FPS = 30;
const SAMPLE_SECONDS = 2;

export class QualityController {
  level = 0;
  /** Set when the player picks a fixed level in the settings; the automatic stepping stops. */
  private fixed = false;
  private frames = 0;
  private elapsed = 0;
  private goodStreak = 0;
  private settle = 3;

  constructor(
    private readonly engine: Engine,
    private readonly shadows: ShadowGenerator,
    private readonly glow: GlowLayer,
    private readonly detail: AbstractMesh[] = [],
  ) {
    this.apply();
    // The pixel budget depends on the window size.
    window.addEventListener("resize", () => this.applyResolution());
  }

  /** `undefined` returns to automatic; 1–5 pins a level (5 = highest). */
  setFixed(q: number | undefined): void {
    this.fixed = q !== undefined;
    if (q !== undefined) {
      this.level = LEVELS.length - q;
      this.apply();
    }
  }

  get label(): string {
    return `Q${LEVELS.length - this.level}`;
  }

  /** Call once per rendered frame with the real frame time. */
  update(dt: number): void {
    // Ignore hitches (tab switch, Logbook open) and the first seconds after a change.
    if (dt > 0.5 || this.fixed) return;
    if (this.settle > 0) {
      this.settle -= dt;
      return;
    }
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < SAMPLE_SECONDS) return;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if (fps < TARGET_FPS - 2 && this.level < LEVELS.length - 1) {
      this.level++;
      this.goodStreak = 0;
      this.apply();
    } else if (fps > 55 && this.level > 0) {
      if (++this.goodStreak >= 5) {
        this.level--;
        this.goodStreak = 0;
        this.apply();
      }
    } else {
      this.goodStreak = 0;
    }
  }

  private applyResolution(): void {
    const l = LEVELS[this.level];
    const cssPixels = Math.max(1, window.innerWidth * window.innerHeight);
    const budget = Math.sqrt((l.megapixels * 1e6) / cssPixels);
    const ratio = Math.min(window.devicePixelRatio || 1, l.pixelRatio, budget);
    this.engine.setHardwareScalingLevel(1 / ratio);
  }

  private apply(): void {
    const l = LEVELS[this.level];
    this.applyResolution();
    const map = this.shadows.getShadowMap();
    if (map && map.getSize().width !== l.shadowMap) map.resize(l.shadowMap);
    this.glow.isEnabled = l.glow;
    for (const m of this.detail) m.setEnabled(l.detail);
    this.settle = 2;
  }
}
