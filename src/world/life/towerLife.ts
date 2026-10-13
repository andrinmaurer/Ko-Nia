import { AbstractMesh, Mesh, ShadowGenerator, TransformNode, Vector3 } from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { TOWER, type TowerFoot } from "../towerFoot";
import { rng } from "../textures";
import { mat } from "./materials";
import { cutout, Form, organic } from "./visuals";

/** Tower Foot species (docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md). No glow anywhere here. */
export function createTowerLife(ctx: GameContext, shadows: ShadowGenerator, world: TowerFoot): LifeForm[] {
  return [
    new WindowBirches(ctx, world),
    new DuctVines(ctx, world),
    new LobbyFigs(ctx),
    new GlassSwallows(ctx, world),
    new PlazaDeer(ctx, shadows),
    new LedgeKite(ctx, shadows, world),
  ];
}

const L = TOWER.levels;
const G = TOWER.ground;

function centre(mesh: AbstractMesh): () => Vector3 {
  return () => mesh.getBoundingInfo().boundingBox.centerWorld;
}

function flat(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function turnTo(node: TransformNode, dir: Vector3, k: number): void {
  const yaw = Math.atan2(dir.x, dir.z);
  let d = yaw - node.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  node.rotation.y += d * Math.min(1, k);
}

// ---------------------------------------------------------------------------
// Window Birch: slim birches on the office floors, leaning out to the open side.
// The observation is the one that came up through a desk.

class WindowBirches implements LifeForm {
  scannables: Scannable[] = [];

  constructor(ctx: GameContext, world: TowerFoot) {
    const scene = ctx.scene;
    const bark = organic(scene, "window-birch-bark", "#d9d4c7", "bark");
    const scar = organic(scene, "window-birch-scar", "#2e2b27", "bark");
    const leaf = cutout(scene, "window-birch-leaves", 256, birchLeaves);
    const r = rng(1201);
    // x, floor level, z, height, lean towards the open east side.
    const spots: { x: number; y: number; z: number; h: number; desk: boolean }[] = [
      ...world.desks.map((d) => ({ x: d.x, y: d.y, z: d.z, h: 2.9, desk: true })),
      { x: 615, y: L[1], z: -29, h: 3, desk: false },
      { x: 609.6, y: L[3], z: -33.5, h: 2.9, desk: false },
      { x: 615, y: L[5], z: -10.5, h: 3, desk: false },
      { x: 609.5, y: L[2], z: -11, h: 2.8, desk: false },
    ];
    for (const s of spots) {
      const f = new Form(scene, "windowBirch");
      const lean = 0.35;
      const top: [number, number, number] = [s.x + lean * s.h * 0.4, s.y + s.h, s.z];
      f.taper([[s.x, s.y, s.z], [s.x + lean * 0.3, s.y + s.h * 0.45, s.z + 0.05], top], 0.075, 0.025, bark, 7);
      // Black bark scars up the trunk.
      for (let k = 0; k < 5; k++) {
        const y = s.y + 0.3 + k * s.h * 0.17;
        f.ellipsoid([s.x + lean * (y - s.y) * 0.4 + 0.06, y, s.z], [0.03, 0.04, 0.09], scar, 5);
      }
      // Thin branches and loose leafy sprays, mostly towards the light.
      for (let k = 0; k < 7; k++) {
        const y = s.y + s.h * (0.45 + r() * 0.5);
        const x = s.x + lean * (y - s.y) * 0.4;
        const a = (r() - 0.3) * Math.PI;
        const len = 0.5 + r() * 0.6;
        const end: [number, number, number] = [x + Math.cos(a) * len, y + 0.25, s.z + Math.sin(a) * len];
        f.taper([[x, y, s.z], end], 0.018, 0.008, bark, 4);
        f.plane([end[0], end[1] - 0.05, end[2]], [0.9, 0.75], [0, r() * 3, 0], leaf);
        f.plane([end[0], end[1] - 0.05, end[2]], [0.8, 0.7], [0, r() * 3 + 1.5, 0], leaf);
      }
      if (s.desk) {
        // Roots over the split desk top and down its legs.
        for (const side of [-1, 1]) f.taper([[s.x, s.y + 0.76, s.z], [s.x + side * 0.35, s.y + 0.78, s.z + 0.1 * side], [s.x + side * 0.7, s.y + 0.4, s.z + 0.2], [s.x + side * 0.75, s.y, s.z + 0.25]], 0.035, 0.015, bark, 5);
      }
      const parts = f.finish();
      for (const p of parts) p.isPickable = true;
      this.scannables.push({
        entryId: "window-birch",
        meshes: parts,
        getPosition: () => new Vector3(s.x + 0.2, s.y + 1.4, s.z),
        isConditionMet: () => s.desk,
      });
    }
  }

  update(): void {}
}

// ---------------------------------------------------------------------------
// Duct Vine: rope-thick stems inside the ducts, leafing out at the seams. One has burst its duct.

class DuctVines implements LifeForm {
  scannables: Scannable[] = [];

  constructor(ctx: GameContext, world: TowerFoot) {
    const scene = ctx.scene;
    const stem = organic(scene, "duct-vine-stem", "#5b4e3a", "bark");
    const leaf = cutout(scene, "duct-vine-leaves", 256, ivyLike);
    const r = rng(1307);
    const cp = TOWER.carPark;
    const ducts = [
      ...world.ducts,
      { from: new Vector3(cp.x0, cp.ceiling - 0.475, cp.z1 - 2.7), to: new Vector3(cp.x1 - 6, cp.ceiling - 0.475, cp.z1 - 2.7), burst: false },
    ];
    for (const d of ducts) {
      const f = new Form(scene, "ductVine");
      const len = d.to.x - d.from.x;
      // The stem shows at the seams, every few metres, more and more towards the east (the light).
      for (let x = d.from.x + 2; x < d.to.x - 0.5; x += 2.5 + r() * 2) {
        const k = (x - d.from.x) / len;
        if (r() > 0.25 + k * 0.7) continue;
        f.taper([[x, d.from.y - 0.25, d.from.z - 0.42], [x + 0.4, d.from.y - 0.33, d.from.z - 0.5], [x + 0.9, d.from.y - 0.45, d.from.z - 0.46]], 0.035, 0.02, stem, 5);
        for (let j = 0; j < 2; j++) f.plane([x + 0.6 + j * 0.3, d.from.y - 0.5, d.from.z - 0.55 + j * 0.1], [0.7, 0.55], [0.3, r() * 3, 0], leaf);
      }
      // Out of the open east end: a curtain of leaves.
      for (let j = 0; j < 4; j++) f.plane([d.to.x + 0.2, d.to.y - 0.4 - j * 0.35, d.to.z + (r() - 0.5) * 0.6], [1, 0.9], [0, Math.PI / 2 + (r() - 0.5), 0], leaf);
      let at = new Vector3(d.to.x - 2.5, d.to.y - 0.3, d.to.z);
      if (d.burst) {
        // The burst duct: a trunk-thick stem between the bent halves, and leaves pouring out.
        const mid = 603;
        at = new Vector3(mid, d.from.y, d.from.z);
        f.taper([[mid - 2.3, d.from.y, d.from.z], [mid - 1, d.from.y - 0.05, d.from.z + 0.08], [mid, d.from.y + 0.02, d.from.z - 0.05], [mid + 1.2, d.from.y - 0.04, d.from.z + 0.06], [mid + 2.3, d.from.y, d.from.z]], 0.16, 0.12, stem, 7);
        for (let j = 0; j < 12; j++) f.plane([mid - 2 + r() * 4, d.from.y - 0.35 - r() * 0.5, d.from.z + (r() - 0.5) * 1.2], [0.9, 0.8], [r() - 0.5, r() * 3, 0], leaf);
        for (let j = 0; j < 4; j++) f.taper([[mid - 1 + j * 0.6, d.from.y - 0.1, d.from.z], [mid - 0.8 + j * 0.6, d.from.y - 0.9, d.from.z + 0.2], [mid - 0.7 + j * 0.6, d.from.y - 1.6, d.from.z + 0.1]], 0.02, 0.008, stem, 4);
      }
      const parts = f.finish();
      for (const p of parts) p.isPickable = true;
      this.scannables.push({ entryId: "duct-vine", meshes: parts, getPosition: () => at, isConditionMet: () => d.burst });
    }
  }

  update(): void {}
}

// ---------------------------------------------------------------------------
// Lobby Fig: roots netted around the atrium columns, a crown under the ceiling. Seen from floor 2.

class LobbyFigs implements LifeForm {
  scannables: Scannable[] = [];

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const root = organic(scene, "lobby-fig-root", "#8f8a7f", "bark");
    const leafMat = organic(scene, "lobby-fig-leaf", "#4f6234", "leaf");
    const leaf = cutout(scene, "lobby-fig-leaves", 256, figLeaves);
    const r = rng(1409);
    const c = TOWER.figColumn;
    const top = L[2] - 0.5;
    // The big one on the middle column, and a younger one on the west column.
    for (const [x, strength] of [[c.x, 1], [590, 0.45]] as const) {
      const f = new Form(scene, "lobbyFig");
      const n = Math.round(16 * strength);
      for (let i = 0; i < n; i++) {
        // Roots spiral down the column from the top, thickening as they near the floor.
        const a0 = (i / n) * Math.PI * 2;
        const pts: [number, number, number][] = [];
        for (let k = 0; k <= 8; k++) {
          const y = top - (k / 8) * (top - G);
          const a = a0 + k * 0.35 * (i % 2 ? 1 : -1);
          const rad = 0.58 + (k === 8 ? 0.25 : 0);
          pts.push([x + Math.cos(a) * rad, y, c.z + Math.sin(a) * rad]);
        }
        f.taper(pts, 0.03 * strength + 0.02, 0.07 * strength + 0.03, root, 5);
      }
      // Cross-ties: the net.
      for (let k = 0; k < 6 * strength; k++) f.ring([x, G + 1 + k * 1.4, c.z], 1.2, 0.05, root);
      if (strength > 0.5) {
        // Crown: leafy masses spreading under the ceiling, and branches out over the atrium.
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const d = 1.2 + r() * 1.6;
          f.ellipsoid([x + Math.cos(a) * d, top - 0.4 - r() * 0.8, c.z + Math.sin(a) * d * 0.8], [2.2, 1, 1.8], leafMat, 6);
          f.taper([[x, top - 0.3, c.z], [x + Math.cos(a) * d * 1.3, top - 0.6, c.z + Math.sin(a) * d]], 0.08, 0.03, root, 5);
          for (let j = 0; j < 3; j++) f.plane([x + Math.cos(a) * (d + 0.6), top - 1 - r() * 0.8, c.z + Math.sin(a) * d * 0.8], [1.3, 1.1], [r() - 0.5, r() * 3, 0], leaf);
        }
      } else {
        for (let i = 0; i < 4; i++) f.plane([x + (r() - 0.5) * 1.4, top - 0.8 - r(), c.z + (r() - 0.5) * 1.4], [1, 0.9], [r() - 0.5, r() * 3, 0], leaf);
      }
      const parts = f.finish();
      for (const p of parts) p.isPickable = true;
      this.scannables.push({
        entryId: "lobby-fig",
        meshes: parts,
        getPosition: () => new Vector3(x, strength > 0.5 ? top - 1.5 : G + 2, c.z),
        // From the top of the column: up on the gallery of floor 2 or above.
        isConditionMet: () => this.ctx.robot.position.y > L[1] - 0.5,
      });
    }
  }

  update(): void {}
}

// ---------------------------------------------------------------------------
// Glass Swallow: nests under the north front's window ledges; dives along the glass morning and evening.

type SwallowState = "nest" | "dive";

class GlassSwallows implements LifeForm {
  scannables: Scannable[] = [];
  private readonly birds: { node: TransformNode; wings: Mesh[]; nest: Vector3; state: SwallowState; t: number; wait: number }[] = [];
  private announced = false;

  constructor(private readonly ctx: GameContext, world: TowerFoot) {
    const scene = ctx.scene;
    // Blue-black back, pale throat, a forked tail.
    const back = organic(scene, "swallow-back", "#1f2733", "feather");
    const throat = organic(scene, "swallow-throat", "#cfc6b4", "feather");
    const mud = organic(scene, "swallow-nest", "#6e604c", "stone");
    for (const [i, ledge] of world.ledges.entries()) {
      // Mud cup under the ledge.
      const cup = new Form(scene, "swallowNest");
      cup.ellipsoid([ledge.x, ledge.y + 0.02, ledge.z], [0.26, 0.16, 0.2], mud, 6);
      for (const m of cup.finish()) m.isPickable = false;
      if (i % 4 === 3) continue;
      const node = new TransformNode("glassSwallow", scene);
      const f = new Form(scene, "swallow-body");
      f.ellipsoid([0, 0, 0], [0.06, 0.06, 0.15], back, 6);
      f.ellipsoid([0, -0.012, 0.04], [0.045, 0.04, 0.05], throat, 5);
      for (const side of [-1, 1]) f.taper([[0, 0, -0.07], [side * 0.03, 0.005, -0.16], [side * 0.05, 0.005, -0.22]], 0.014, 0.003, back, 4);
      const parts = f.finish(node);
      const wings: Mesh[] = [];
      for (const side of [-1, 1]) {
        const w = new Form(scene, "swallow-wing");
        w.taper([[0, 0, 0.02], [side * 0.11, 0.005, -0.01], [side * 0.2, 0, -0.08]], 0.022, 0.005, back, 4);
        wings.push(w.finish(node)[0]);
      }
      const nest = ledge.add(new Vector3(0, 0.14, 0.08));
      node.position.copyFrom(nest);
      node.rotation.y = Math.PI;
      this.birds.push({ node, wings, nest, state: "nest", t: 0, wait: i * 2.5 });
      this.scannables.push({
        entryId: "glass-swallow",
        meshes: [...parts, ...wings],
        getPosition: () => node.position,
        isConditionMet: () => this.birds.find((b) => b.node === node)!.state === "dive",
      });
    }
  }

  /** Insects rise over the plaza early and late in the day. */
  private hunting(): boolean {
    const h = this.ctx.time.hours;
    return (h >= 6 && h < 9) || (h >= 16.5 && h < 19.5);
  }

  update(dt: number): void {
    const hunting = this.hunting();
    if (hunting && !this.announced && flat(this.ctx.robot.position, new Vector3(596, 0, -8)) < 45) {
      this.announced = true;
      this.ctx.caption("Twittering: the swallows pour off the ledges and down the glass.", 3);
    }
    if (!hunting) this.announced = false;
    const now = performance.now() / 1000;
    for (const [i, b] of this.birds.entries()) {
      if (b.state === "nest") {
        b.node.position.copyFrom(b.nest);
        b.node.rotation.y = Math.PI;
        for (const w of b.wings) w.rotation.z = 0;
        if (hunting && (b.wait -= dt) <= 0) {
          b.state = "dive";
          b.t = 0;
        }
        continue;
      }
      // A loop: out from the ledge, a dive down the glass, a skim along the front, and up again.
      b.t += dt / 6;
      const k = b.t;
      const n = b.nest;
      const dir = i % 2 ? 1 : -1;
      const p = loop(n, dir, k);
      const ahead = loop(n, dir, Math.min(1, k + 0.02));
      b.node.position.copyFrom(p);
      turnTo(b.node, ahead.subtract(p), 1);
      const flap = Math.sin(now * 24 + i) * 0.7;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
      if (b.t >= 1) {
        b.state = "nest";
        b.wait = hunting ? 1 + Math.random() * 4 : 0;
      }
    }
  }
}

/** One swallow loop from its nest: out, down along the glass, along the front, and back. */
function loop(n: Vector3, dir: number, k: number): Vector3 {
  const route = [
    n,
    new Vector3(n.x + dir * 1, n.y + 1, n.z + 3),
    new Vector3(n.x + dir * 3, G + 2.2, n.z + 1.2),
    new Vector3(n.x + dir * 9, G + 1.6, n.z + 1),
    new Vector3(n.x + dir * 12, n.y + 1.5, n.z + 4),
    new Vector3(n.x + dir * 3, n.y + 2, n.z + 5),
    n,
  ];
  const lengths = route.slice(1).map((p, i) => Vector3.Distance(route[i], p));
  let d = Math.max(0, Math.min(1, k)) * lengths.reduce((a, b) => a + b, 0);
  for (const [i, len] of lengths.entries()) {
    if (d <= len) return Vector3.Lerp(route[i], route[i + 1], len > 0 ? d / len : 0);
    d -= len;
  }
  return n.clone();
}

// ---------------------------------------------------------------------------
// Plaza Deer: a small group grazing the plaza forest. Running, or coming too close, sends them bounding off.

type DeerState = "graze" | "flee" | "wary";
const DEER_AREA = { x0: 606, x1: 656, z0: 4, z1: 40 };

class PlazaDeer implements LifeForm {
  scannables: Scannable[] = [];
  private readonly herd: { node: TransformNode; head: TransformNode; legs: TransformNode[]; target: Vector3; pause: number; stride: number }[] = [];
  private state: DeerState = "graze";
  private timer = 0;
  private fleeFrom = Vector3.Zero();

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const coat = organic(scene, "plaza-deer-coat", "#8a5c3c", "fur");
    const pale = organic(scene, "plaza-deer-pale", "#d8cdb8", "fur");
    const dark = mat(scene, "plaza-deer-nose", 0.1, 0.08, 0.07, 0.3);
    const r = rng(1511);
    for (let i = 0; i < 4; i++) {
      const node = new TransformNode("plazaDeer", scene);
      const s = i === 0 ? 1.1 : 0.85 + r() * 0.15;
      node.scaling.setAll(s);
      const f = new Form(scene, "deer-body");
      f.ellipsoid([0, 0.78, 0], [0.34, 0.38, 0.85], coat);
      f.ellipsoid([0, 0.66, 0.05], [0.26, 0.2, 0.7], pale);
      // White spots along the flanks.
      for (let k = 0; k < 14; k++) {
        const side = k % 2 ? 1 : -1;
        f.ellipsoid([side * 0.165, 0.82 + (r() - 0.5) * 0.18, -0.3 + (k / 14) * 0.6], [0.03, 0.04, 0.05], pale, 4);
      }
      f.taper([[0, 0.92, -0.38], [0, 0.98, -0.46]], 0.06, 0.02, pale, 5);
      f.taper([[0, 0.9, 0.3], [0, 1.15, 0.45]], 0.1, 0.075, coat, 6);
      const parts = f.finish(node);
      const head = new TransformNode("deerHead", scene);
      head.parent = node;
      head.position.set(0, 1.18, 0.5);
      const h = new Form(scene, "deer-head");
      h.ellipsoid([0, 0, 0.06], [0.14, 0.15, 0.26], coat);
      h.ellipsoid([0, -0.03, 0.2], [0.08, 0.08, 0.1], pale, 5);
      h.ellipsoid([0, -0.02, 0.26], [0.04, 0.035, 0.03], dark, 4);
      for (const side of [-1, 1]) {
        const ear = h.ellipsoid([side * 0.09, 0.12, -0.02], [0.05, 0.14, 0.03], coat, 5);
        ear.rotation.z = -side * 0.5;
        h.ellipsoid([side * 0.065, 0.03, 0.12], [0.025, 0.025, 0.02], dark, 4);
      }
      parts.push(...h.finish(head));
      const legs: TransformNode[] = [];
      for (const [x, z] of [[-0.12, 0.42], [0.12, 0.42], [-0.12, -0.38], [0.12, -0.38]]) {
        const hip = new TransformNode("deerLeg", scene);
        hip.parent = node;
        hip.position.set(x, 0.72, z);
        const l = new Form(scene, "deer-leg");
        l.taper(z < 0 ? [[0, 0, 0], [0, -0.3, -0.1], [0, -0.55, 0.02], [0, -0.72, 0.03]] : [[0, 0, 0], [0, -0.38, 0.02], [0, -0.72, 0.01]], 0.05, 0.02, coat, 5);
        l.ellipsoid([0, -0.72, 0.03], [0.035, 0.03, 0.05], dark, 4);
        parts.push(...l.finish(hip));
        legs.push(hip);
      }
      for (const p of parts) {
        shadows.addShadowCaster(p);
        p.isPickable = true;
      }
      node.position.set(620 + i * 3 + r() * 2, G, 22 + r() * 6);
      node.rotation.y = r() * 6;
      const deer = { node, head, legs, target: node.position.clone(), pause: r() * 4, stride: 0 };
      this.herd.push(deer);
      this.scannables.push({
        entryId: "plaza-deer",
        meshes: parts,
        getPosition: () => node.position.add(new Vector3(0, 0.9 * s, 0)),
        isConditionMet: () => this.state === "graze" && Vector3.Distance(this.ctx.robot.position, node.position) < 10,
      });
    }
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const onPlaza = robot.y > G - 1 && robot.y < G + 4;
    this.timer -= dt;
    const nearest = Math.min(...this.herd.map((d) => flat(robot, d.node.position)));
    const running = this.ctx.robot.isSprinting && this.ctx.robotSpeed > 5;
    if (onPlaza && this.state !== "flee" && (nearest < 4.5 || (running && nearest < 25))) {
      this.state = "flee";
      this.timer = 3.5;
      this.fleeFrom = robot.clone();
      this.ctx.caption("Hooves on stone: the deer bolts into the trees.", 2.5);
    }
    if (this.state === "flee" && this.timer <= 0) {
      this.state = "wary";
      this.timer = 12;
    }
    if (this.state === "wary" && this.timer <= 0) this.state = "graze";
    for (const d of this.herd) {
      const p = d.node.position;
      let speed = 0;
      if (this.state === "flee") {
        const away = p.subtract(this.fleeFrom);
        away.y = 0;
        d.target = p.add(away.normalize().scale(6));
        speed = 7;
      } else {
        d.pause -= dt;
        if (flat(p, d.target) < 0.3) {
          if (d.pause <= 0) {
            // A few steps to fresh grass, then head down again.
            d.target = new Vector3(Math.min(DEER_AREA.x1, Math.max(DEER_AREA.x0, p.x + (Math.random() - 0.5) * 6)), G, Math.min(DEER_AREA.z1, Math.max(DEER_AREA.z0, p.z + (Math.random() - 0.5) * 6)));
            d.pause = 4 + Math.random() * 6;
          }
        } else speed = 0.8;
      }
      const to = d.target.subtract(p);
      to.y = 0;
      if (speed > 0 && to.length() > 0.05) {
        p.addInPlace(to.normalize().scale(Math.min(to.length(), speed * dt)));
        turnTo(d.node, to, dt * (speed > 3 ? 8 : 3));
      }
      p.x = Math.min(DEER_AREA.x1 + 4, Math.max(DEER_AREA.x0 - 6, p.x));
      p.z = Math.min(DEER_AREA.z1 + 4, Math.max(DEER_AREA.z0 - 4, p.z));
      // Bounding: the body rises and falls with each leap.
      d.stride += dt * (speed > 3 ? 10 : 5) * (speed > 0 ? 1 : 0);
      p.y = G + (speed > 3 ? Math.abs(Math.sin(d.stride)) * 0.35 : 0);
      const swing = speed > 0 ? Math.sin(d.stride) * (speed > 3 ? 0.8 : 0.35) : 0;
      for (const [i, leg] of d.legs.entries()) leg.rotation.x = swing * (i % 3 === 0 ? 1 : -1);
      // Grazing: head down, ears flicking; wary or running: head up.
      const down = this.state === "graze" && speed === 0;
      d.head.rotation.x += ((down ? 1.1 : -0.1) - d.head.rotation.x) * Math.min(1, dt * 3);
      d.head.position.y = 1.18 - (down ? 0.5 : 0) * Math.min(1, d.head.rotation.x);
    }
  }
}

// ---------------------------------------------------------------------------
// Ledge Kite: circles its nest on the split side; swoops at anything that comes near and knocks it
// off the ledge. Twice a day it hunts over the plaza and the nest is unguarded.

type KiteState = "home" | "roost" | "hunt" | "stoop" | "ground" | "rise" | "warn" | "swoop" | "back";

class LedgeKite implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly wings: TransformNode[] = [];
  private state: KiteState = "home";
  private timer = 0;
  private angle = 0;
  private cooldown = 0;
  private prey = Vector3.Zero();
  private readonly nest: Vector3;

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator, world: TowerFoot) {
    const scene = ctx.scene;
    this.nest = TOWER.nest.add(new Vector3(0, 0.45, 0));
    // Rust-brown wings with dark tips, a pale grey head, a deeply forked tail.
    const rust = organic(scene, "ledge-kite-rust", "#8a4a2c", "feather");
    const dark = organic(scene, "ledge-kite-dark", "#2c2522", "feather");
    const head = organic(scene, "ledge-kite-head", "#b8b0a2", "feather");
    const beak = mat(scene, "ledge-kite-beak", 0.75, 0.6, 0.25, 0.3);
    this.node = new TransformNode("ledgeKite", scene);
    const f = new Form(scene, "kite-body");
    f.ellipsoid([0, 0, 0], [0.16, 0.16, 0.5], rust, 7);
    f.ellipsoid([0, 0.03, 0.24], [0.12, 0.12, 0.14], head, 6);
    f.taper([[0, 0.02, 0.32], [0, 0, 0.38], [0, -0.03, 0.39]], 0.025, 0.006, beak, 4);
    for (const side of [-1, 1]) f.taper([[0, 0, -0.2], [side * 0.08, 0, -0.45], [side * 0.16, 0, -0.62]], 0.05, 0.015, rust, 4);
    const parts = f.finish(this.node);
    for (const side of [-1, 1]) {
      const pivot = new TransformNode("kiteWing", scene);
      pivot.parent = this.node;
      pivot.position.set(side * 0.1, 0.03, 0.04);
      const w = new Form(scene, "kite-wing");
      w.box([side * 0.42, 0, 0], [0.8, 0.03, 0.34], rust);
      w.box([side * 0.95, 0, -0.04], [0.32, 0.025, 0.26], dark);
      parts.push(...w.finish(pivot));
      this.wings.push(pivot);
    }
    for (const p of parts) {
      shadows.addShadowCaster(p);
      p.isPickable = true;
    }
    this.node.position.copyFrom(this.nest).addInPlace(new Vector3(-7, 6, 0));
    this.scannables = [
      { entryId: "ledge-kite", meshes: parts, getPosition: () => this.node.position, isConditionMet: () => false },
      {
        entryId: "ledge-kite",
        meshes: world.nest,
        getPosition: () => TOWER.nest.add(new Vector3(0, 0.3, 0)),
        // The observation: the nest, while the kite is away hunting.
        isConditionMet: () => this.away(),
      },
    ];
  }

  private huntHours(): boolean {
    const h = this.ctx.time.hours;
    return (h >= 9 && h < 11.5) || (h >= 15 && h < 17.5);
  }

  private roostHours(): boolean {
    const h = this.ctx.time.hours;
    return h >= 20.5 || h < 5.5;
  }

  private away(): boolean {
    return this.state === "hunt" || this.state === "stoop" || this.state === "ground" || this.state === "rise";
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const p = this.node.position;
    this.timer -= dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const toNest = Vector3.Distance(robot, TOWER.nest);
    let goal: Vector3 | undefined;
    let speed = 7;
    let flap = false;
    switch (this.state) {
      case "home":
      case "back": {
        // Circling the split side, just above the nest.
        this.angle += dt * 0.45;
        goal = this.nest.add(new Vector3(Math.cos(this.angle) * 7, 5 + Math.sin(this.angle * 2) * 0.8, Math.sin(this.angle) * 7));
        if (this.state === "back" && Vector3.Distance(p, goal) < 2) this.state = "home";
        if (this.huntHours()) this.state = "hunt";
        else if (this.roostHours()) { this.state = "roost"; }
        else if (this.cooldown <= 0 && toNest < 10) this.warn();
        break;
      }
      case "roost":
        goal = this.nest;
        speed = 6;
        // Asleep on the nest; only a robot right beside it wakes it.
        if (!this.roostHours()) this.state = "home";
        else if (this.cooldown <= 0 && toNest < 4.5 && Vector3.Distance(p, this.nest) < 0.5) this.warn();
        break;
      case "hunt": {
        // Wide circles over the plaza; now and then a stoop to the grass.
        this.angle += dt * 0.3;
        goal = new Vector3(610 + Math.cos(this.angle) * 20, 20 + Math.sin(this.angle * 3) * 2, 20 + Math.sin(this.angle) * 16);
        if (this.timer <= 0) {
          this.state = "stoop";
          this.prey = new Vector3(DEER_AREA.x0 - 20 + Math.random() * 60, G + 0.15, DEER_AREA.z0 - 4 + Math.random() * 36);
        }
        if (!this.huntHours()) this.state = "back";
        break;
      }
      case "stoop":
        goal = this.prey;
        speed = 14;
        if (Vector3.Distance(p, this.prey) < 0.4) {
          this.state = "ground";
          this.timer = 5;
        }
        break;
      case "ground":
        // On the grass with whatever it caught, wings mantled.
        goal = this.prey;
        speed = 0;
        if (this.timer <= 0 || flat(robot, p) < 3) {
          this.state = "rise";
          this.timer = 3;
        }
        break;
      case "rise":
        goal = this.prey.add(new Vector3(0, 18, 0));
        speed = 6;
        flap = true;
        if (this.timer <= 0) {
          this.state = "hunt";
          this.timer = 12 + Math.random() * 10;
        }
        break;
      case "warn":
        // Circling tighter, whistling; then it comes in.
        this.angle += dt * 1.1;
        goal = robot.add(new Vector3(Math.cos(this.angle) * 6, 6, Math.sin(this.angle) * 6));
        speed = 10;
        if (toNest > 14) this.state = "back";
        else if (this.timer <= 0) {
          this.state = "swoop";
          this.timer = 2.5;
        }
        break;
      case "swoop":
        goal = robot.add(new Vector3(0, 0.9, 0));
        speed = 18;
        if (Vector3.Distance(p, goal) < 1.2) this.strike();
        else if (this.timer <= 0 || toNest > 16) {
          this.state = "back";
          this.cooldown = 4;
        }
        break;
    }
    if (goal && speed > 0) {
      const to = goal.subtract(p);
      const len = to.length();
      if (len > 0.01) {
        p.addInPlace(to.scale(Math.min(1, (speed * dt) / len)));
        turnTo(this.node, to, dt * (speed > 10 ? 10 : 3));
        // Bank into the turn, pitch into a dive.
        this.node.rotation.x = Math.max(-0.9, Math.min(0.6, -Math.atan2(to.y, Math.hypot(to.x, to.z)) * 0.8));
      }
    } else this.node.rotation.x = 0;
    const perched = this.state === "ground" || (this.state === "roost" && Vector3.Distance(p, this.nest) < 0.5);
    const now = performance.now() / 1000;
    // Mostly gliding: a few slow beats now and then, fast beats climbing, folded when perched.
    const beat = perched ? 0 : flap || this.state === "swoop" ? Math.sin(now * 10) * 0.5 : Math.sin(now * 3) * (Math.sin(now * 0.7) > 0.6 ? 0.35 : 0.05);
    this.wings[0].rotation.z = perched ? 0.9 : beat;
    this.wings[1].rotation.z = perched ? -0.9 : -beat;
    for (const w of this.wings) w.scaling.x = perched ? 0.55 : 1;
  }

  private warn(): void {
    this.state = "warn";
    this.timer = 2.4;
    this.ctx.caption("A thin, high whistle overhead: the kite is circling closer.", 2.5);
  }

  private strike(): void {
    const robot = this.ctx.robot.position;
    // Off the ledge: outwards, away from the middle of the tower.
    const t = TOWER.tower;
    const away = robot.subtract(new Vector3((t.x0 + t.x1) / 2, robot.y, (t.z0 + t.z1) / 2));
    away.y = 0;
    const push = away.normalize().scale(14);
    push.y = 3;
    this.ctx.robot.push(push);
    this.ctx.status.energy = Math.max(0, this.ctx.status.energy - 15);
    this.ctx.caption("A rush of wings: knocked off balance by the kite. Energy lost.", 3);
    this.state = "back";
    this.cooldown = 8;
  }
}

// ---------------------------------------------------------------------------
// The tower's artifacts and the Predecessor (scan once).

export function createTowerDiscoveries(ctx: GameContext, world: TowerFoot): Scannable[] {
  void ctx;
  return [
    { entryId: "art-revolving-door", meshes: world.revolvingDoor, getPosition: () => new Vector3(596, G + 1.4, TOWER.tower.z1) },
    { entryId: "art-lobby-directory", meshes: world.directory, getPosition: centre(world.directory[0]) },
    { entryId: "art-elevator-car", meshes: world.elevatorCar, getPosition: centre(world.elevatorCar[0]) },
    { entryId: "art-city-model", meshes: world.cityModel, getPosition: centre(world.cityModel[0]) },
    { entryId: "origin-terrace", meshes: world.predecessor, getPosition: () => TOWER.predecessor.add(new Vector3(0, 0.7, 0)) },
  ];
}

// ---------------------------------------------------------------------------
// Painted cut-outs.

/** Birch spray: small, toothed, yellow-green leaves on hair-thin twigs. */
function birchLeaves(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  c.strokeStyle = "#4a3f33";
  c.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(s / 2, s);
    c.quadraticCurveTo(s * r(), s * 0.6, s * (0.1 + r() * 0.8), s * (0.1 + r() * 0.3));
    c.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = s * (0.08 + r() * 0.84), y = s * (0.06 + r() * 0.7), size = s * (0.03 + r() * 0.025);
    c.fillStyle = `rgb(${110 + r() * 40},${135 + r() * 30},${60 + r() * 20})`;
    c.save();
    c.translate(x, y);
    c.rotate(r() * Math.PI * 2);
    c.beginPath();
    c.moveTo(0, -size);
    c.quadraticCurveTo(size * 0.8, 0, 0, size);
    c.quadraticCurveTo(-size * 0.8, 0, 0, -size);
    c.fill();
    c.restore();
  }
}

/** Duct vine: glossy dark leaves with three lobes. */
function ivyLike(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  for (let i = 0; i < 22; i++) {
    const x = s * (0.12 + r() * 0.76), y = s * (0.12 + r() * 0.76), size = s * (0.07 + r() * 0.05);
    const g = r();
    c.fillStyle = `rgb(${50 + g * 30},${75 + g * 30},${38 + g * 14})`;
    c.save();
    c.translate(x, y);
    c.rotate(r() * Math.PI * 2);
    c.beginPath();
    for (let k = 0; k <= 6; k++) {
      const t = (k / 6) * Math.PI * 2;
      const rad = k % 2 ? size * 0.5 : size;
      c.lineTo(Math.cos(t) * rad, Math.sin(t) * rad);
    }
    c.fill();
    c.restore();
  }
}

/** Fig leaves: big, oval, leathery and dark. */
function figLeaves(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  for (let i = 0; i < 16; i++) {
    const x = s * (0.15 + r() * 0.7), y = s * (0.15 + r() * 0.7), size = s * (0.09 + r() * 0.05);
    const g = r();
    c.fillStyle = `rgb(${55 + g * 25},${80 + g * 25},${40 + g * 15})`;
    c.save();
    c.translate(x, y);
    c.rotate(r() * Math.PI * 2);
    c.beginPath();
    c.ellipse(0, 0, size * 0.55, size, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(200,200,150,0.35)";
    c.beginPath();
    c.moveTo(0, -size);
    c.lineTo(0, size);
    c.stroke();
    c.restore();
  }
}
