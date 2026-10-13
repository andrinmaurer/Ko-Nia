import {
  AbstractMesh,
  Color3,
  Ray,
  Vector3,
  type Camera,
} from "../babylon";
import type { GameContext, Scannable } from "../game/context";
import { SCAN_COST } from "../player/status";
import type { Hud } from "../ui/hud";
import { ENTRY_BY_ID, stepsFor, unknownNumber, type EntryDef } from "./entries";
import { blockLocationOf, locationAt } from "./locations";
import type { EntryProgress, Learned, ScanMode } from "./logbook";

export const SCAN_MODES: ScanMode[] = ["visual", "bio", "audio", "night", "thermal", "genetic", "radiation"];
const RANGE: Record<ScanMode, number> = { visual: 25, bio: 8, audio: 25, night: 25, thermal: 35, genetic: 15, radiation: 25 };
/** Small or moving things can be targeted by aiming within this angle of them. */
const AIM_ASSIST = 0.07;
const OUTLINE = new Color3(0.55, 0.95, 1);

interface Target {
  scannable: Scannable;
  distance: number;
}

/**
 * The scanner lens: toggled with right click, modes cycled with the arrow keys,
 * left click scans whatever is under the reticle.
 */
export class Scanner {
  lensOn = false;
  mode: ScanMode = "visual";
  private target: Target | undefined;
  private outlined: AbstractMesh[] = [];
  private cooldown = 0;
  private readonly meshOwner = new Map<AbstractMesh, Scannable>();

  constructor(
    private readonly ctx: GameContext,
    private readonly camera: Camera,
    private readonly hud: Hud,
    private readonly scannables: Scannable[],
    private readonly onScanned: () => void,
  ) {
    for (const s of scannables) for (const m of s.meshes) this.meshOwner.set(m, s);
  }

  /** What the lens is locked on, if anything. */
  get targeted(): Scannable | undefined {
    return this.target?.scannable;
  }

  toggleLens(): void {
    this.lensOn = !this.lensOn;
    if (!this.lensOn) this.setTarget(undefined);
    this.hud.setLens(this.lensOn, this.mode);
  }

  get availableModes(): ScanMode[] {
    return SCAN_MODES.filter((m) => m === "visual" || m === "bio" || m === "audio" || this.ctx.upgrades.has(m));
  }

  cycleMode(step: number): void {
    const modes = this.availableModes;
    const i = modes.indexOf(this.mode);
    this.mode = modes[(i + step + modes.length) % modes.length];
    this.hud.setLens(this.lensOn, this.mode);
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const s of this.scannables) {
      const animal = ENTRY_BY_ID.get(s.entryId)?.category === "fauna";
      const warm = this.lensOn && this.mode === "thermal" && animal && (s.isAvailable?.() ?? true) && Vector3.Distance(s.getPosition(), this.ctx.robot.position) <= 35 && this.visible(this.ctx.robot.eyePosition, s.getPosition(), s);
      for (const m of s.meshes) { m.renderOverlay = !!warm; if (warm) { m.overlayColor = new Color3(1, 0.3, 0.05); m.overlayAlpha = 0.65; } }
    }
    if (!this.lensOn) return;
    if ((this.mode === "night" || this.mode === "thermal") && !this.ctx.status.trySpend(2 * dt)) { this.toggleLens(); this.hud.notice("Lens powered down: recharge required."); return; }
    if (this.mode === "radiation") { this.setTarget(undefined); this.hud.setTarget("Ambient radiation", "Background levels · safe", true); return; }
    this.setTarget(this.findTarget());
    const t = this.target;
    if (!t) {
      this.hud.setTarget(undefined);
      return;
    }
    const def = ENTRY_BY_ID.get(t.scannable.entryId)!;
    const p = this.ctx.logbook.get(def.id);
    const inRange = t.distance <= RANGE[this.mode];
    const steps = stepsFor(def);
    const done = this.ctx.logbook.stepsDone(def.id);
    this.hud.setTarget(displayName(def, p, done === steps), `${done}/${steps}`, inRange);
  }

  scan(): void {
    if (!this.lensOn || this.cooldown > 0) return;
    this.cooldown = 0.6;
    const t = this.target;
    if (this.ctx.sensorsJammed > 0) {
      this.hud.notice("Sensors clogged with spores. Wait for them to clear.");
      return;
    }
    if (this.mode === "radiation") {
      if (this.ctx.status.trySpend(25)) this.hud.notice("Radiation survey: background levels. No active sources detected in these districts.");
      else this.hud.notice("Not enough energy to survey");
      return;
    }
    if (!t) {
      this.hud.notice("Nothing to scan");
      return;
    }
    const def = ENTRY_BY_ID.get(t.scannable.entryId)!;
    const organism = stepsFor(def) === 3;
    if ((this.mode === "bio" || this.mode === "genetic") && !organism) {
      this.hud.notice("No biological signature");
      return;
    }
    if (t.distance > RANGE[this.mode]) {
      this.hud.notice(this.mode === "bio" ? "Too far for a Biological scan" : "Too far to scan");
      return;
    }
    if (!this.ctx.status.trySpend(this.mode === "genetic" ? 25 : SCAN_COST)) {
      this.hud.notice("Not enough energy to scan");
      return;
    }

    const logbook = this.ctx.logbook;
    const when = { day: this.ctx.time.day, hour: this.ctx.time.hours };
    const locationId = locationAt(this.ctx.robot.position);
    const condition = t.scannable.isConditionMet?.() ?? false;
    const where = { x: this.ctx.robot.position.x, z: this.ctx.robot.position.z };
    const learned = logbook.recordScan(def.id, this.mode, condition, when, locationId, where);
    const newLocation = logbook.discoverLocation(locationId, when);
    const blockId = blockLocationOf(locationId);
    const newBlock = blockId !== undefined && logbook.discoverLocation(blockId, when);

    this.hud.shutter();
    this.announce(def, learned);
    if (this.mode === "genetic") this.hud.caption(`Lineage analysis: ${def.latin ?? def.name}`, 5);
    if (newBlock) this.hud.toast("Location recorded", ENTRY_BY_ID.get(blockId)!.name, { kind: "place" });
    if (newLocation) this.hud.toast("Location recorded", ENTRY_BY_ID.get(locationId)!.name, { kind: "place" });
    this.onScanned();
  }

  private announce(def: EntryDef, learned: Learned[]): void {
    const p = this.ctx.logbook.get(def.id);
    const complete = learned.includes("complete");
    const name = displayName(def, p, complete);
    const kind = stepsFor(def) === 3 ? "bio" : def.category === "origin" ? "system" : "place";
    for (const l of learned) {
      if (l === "created") this.hud.toast("Logbook entry created", name, { kind, field: "Appearance recorded" });
      if (l === "ancestry") this.hud.toast("Ancestry identified", name, { kind, field: def.latin });
      if (l === "behavior") this.hud.toast("Behavior observed", name, { kind, field: def.observation });
      if (l === "complete" && stepsFor(def) === 3) this.hud.toast("Entry complete", def.name, { kind, field: def.latin });
      // The lead for the next step lives in the Logbook only, so the player has a reason to open it.
      if (l === "nothing") this.hud.notice(nextHint(def, p) ? "Nothing new here · the Logbook has a lead (Tab)" : "No new information");
    }
  }

  private findTarget(): Target | undefined {
    const scene = this.ctx.scene;
    const eye = this.ctx.robot.eyePosition;
    const ray = this.camera.getForwardRay(60);

    // 1. Whatever the reticle points at directly.
    const hit = scene.pickWithRay(ray, (m) => m.isVisible && m.isEnabled() && (this.meshOwner.has(m) || m.checkCollisions));
    if (hit?.hit && hit.pickedMesh && hit.pickedPoint) {
      const s = this.meshOwner.get(hit.pickedMesh);
      if (s && (s.isAvailable?.() ?? true)) return { scannable: s, distance: Vector3.Distance(eye, hit.pickedPoint) };
    }

    // 2. Aim assist for small or moving targets close to the reticle.
    let best: Target | undefined;
    let bestAngle = AIM_ASSIST;
    const blockingDistance = hit?.hit ? hit.distance : Infinity;
    for (const s of this.scannables) {
      // Scannables in the block that isn't drawn right now are disabled.
      if (!s.meshes[0]?.isEnabled() || !(s.isAvailable?.() ?? true)) continue;
      const p = s.getPosition();
      const to = p.subtract(ray.origin);
      const along = to.length();
      if (along > 60 || along > blockingDistance + 1) continue;
      const angle = Math.acos(Math.min(1, Vector3.Dot(to.normalize(), ray.direction)));
      if (angle < bestAngle && this.visible(ray.origin, p, s)) {
        bestAngle = angle;
        best = { scannable: s, distance: Vector3.Distance(eye, p) };
      }
    }
    return best;
  }

  private visible(from: Vector3, to: Vector3, s: Scannable): boolean {
    const dir = to.subtract(from);
    const length = dir.length();
    const hit = this.ctx.scene.pickWithRay(
      new Ray(from, dir.normalize(), length),
      (m) => m.checkCollisions && m.isVisible && m.isEnabled() && !s.meshes.includes(m),
    );
    return !hit?.hit || hit.distance > length - 0.5;
  }

  private setTarget(t: Target | undefined): void {
    const meshes = t?.scannable.meshes ?? [];
    for (const m of this.outlined) if (!meshes.includes(m)) m.renderOutline = false;
    for (const m of meshes) {
      m.renderOutline = true;
      m.outlineColor = OUTLINE;
      m.outlineWidth = 0.025;
    }
    this.outlined = meshes;
    this.target = t;
  }
}

/** Name shown in the scanner and the Logbook for the current state of an entry. */
export function displayName(def: EntryDef, p: EntryProgress, complete: boolean): string {
  const organism = stepsFor(def) === 3;
  if (!p.discovered) return organism ? "UNKNOWN ORGANISM" : "UNIDENTIFIED OBJECT";
  if (organism && !complete) return `UNKNOWN ORGANISM ${unknownNumber(def.id)}`;
  return def.name;
}

/** Hint for the next missing step of an organism page. */
export function nextHint(def: EntryDef, p: EntryProgress): string | undefined {
  if (!def.hints || !p.discovered) return undefined;
  if (!p.bio) return `${def.hints.bio} Switch the lens to Biological with ← → and scan up close.`;
  if (!p.observed) return def.hints.observe;
  return undefined;
}
