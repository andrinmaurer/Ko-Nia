import { AbstractMesh, Color3, Mesh, MeshBuilder, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { ARCADE, ARCADE_AXIS, waterAt, type FloodedArcade } from "../floodedArcade";
import { rng } from "../textures";
import { mat } from "./materials";
import { Form, organic } from "./visuals";

/** Flooded Arcade species and water rules (docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md). */
export function createArcadeLife(ctx: GameContext, shadows: ShadowGenerator, world: FloodedArcade): LifeForm[] {
  return [
    new ArcadeWater(ctx),
    new GlasswortReeds(ctx, world),
    new GutterLilies(ctx),
    new ShopfrontMoss(world),
    new WaderHeron(ctx, shadows),
    new MudskipperShoals(ctx, world),
    new SnappingEel(ctx, shadows),
  ];
}

function centre(mesh: AbstractMesh): () => Vector3 {
  return () => mesh.getBoundingInfo().boundingBox.centerWorld;
}

function flat(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Low sun: early morning and late afternoon. */
function lowSun(hours: number): boolean {
  return (hours >= 6 && hours < 8.5) || (hours >= 16.5 && hours < 19.5);
}

// ---------------------------------------------------------------------------
// Water: deep water sends the robot back to where it last stood, and wading
// leaves rings on the surface. (Wading speed and energy are handled in main.)

class ArcadeWater implements LifeForm {
  scannables: Scannable[] = [];
  private readonly safe: { p: Vector3; t: number }[] = [];
  private readonly ring: Mesh;
  private readonly ringMat: StandardMaterial;
  private ringT = 1;
  private clock = 0;
  private cooldown = 0;

  constructor(private readonly ctx: GameContext) {
    this.ringMat = mat(ctx.scene, "wadeRing", 0.85, 0.9, 0.88, 0.4);
    this.ringMat.alpha = 0;
    this.ring = MeshBuilder.CreateTorus("wadeRing", { diameter: 1, thickness: 0.04, tessellation: 20 }, ctx.scene);
    this.ring.material = this.ringMat;
    this.ring.isPickable = false;
  }

  update(dt: number): void {
    this.clock += dt;
    this.cooldown -= dt;
    const robot = this.ctx.robot;
    const p = robot.position;
    const state = waterAt(p);
    if (robot.isGrounded && state !== "deep" && p.y > -0.3) {
      const last = this.safe[this.safe.length - 1];
      // A jump in position (relay, respawn) starts a fresh trail.
      if (last && Vector3.Distance(last.p, p) > 3) this.safe.length = 0;
      if (!last || this.clock - last.t > 0.25) this.safe.push({ p: p.clone(), t: this.clock });
      while (this.safe.length > 12) this.safe.shift();
    }
    if (state === "deep" && this.cooldown <= 0) {
      // A spot from about a second ago, safely back from the edge.
      const back = [...this.safe].reverse().find((s) => this.clock - s.t > 0.75) ?? this.safe[0];
      if (back) robot.teleport(back.p, robot.visual.rotation.y);
      this.cooldown = 1;
      this.ctx.status.energy = Math.max(0, this.ctx.status.energy - 20);
      this.ctx.caption("Too deep. The unit hauls itself back out.", 3);
    }
    // Rings spreading from the robot's legs while it wades.
    if (state === "wade" && this.ctx.robotSpeed > 0.5 && this.ringT >= 0.6) {
      this.ringT = 0;
      this.ring.position.set(p.x, ARCADE.water + 0.01, p.z);
    }
    this.ringT = Math.min(1, this.ringT + dt * 1.2);
    this.ring.scaling.setAll(0.8 + this.ringT * 2.4);
    this.ringMat.alpha = (1 - this.ringT) * 0.5;
    this.ring.isVisible = this.ringT < 1;
  }
}

// ---------------------------------------------------------------------------
// Glasswort Reed: reed beds that root in fallen roof glass.

class GlasswortReeds implements LifeForm {
  scannables: Scannable[] = [];
  private readonly clumps: TransformNode[] = [];

  constructor(private readonly ctx: GameContext, world: FloodedArcade) {
    const scene = ctx.scene;
    const stem = organic(scene, "glasswort-stem", "#5f6f45", "leaf");
    const tip = organic(scene, "glasswort-tip", "#8a7d55", "fur");
    const r = rng(442);
    const spots: { p: Vector3; onGlass: boolean }[] = [
      ...world.glassPiles.map((p) => ({ p, onGlass: true })),
      { p: new Vector3(ARCADE.mudBank.x0 + 1.2, ARCADE.mudBank.y, ARCADE.mudBank.z1 - 0.8), onGlass: false },
      { p: new Vector3(335, 0, 30), onGlass: false },
      { p: new Vector3(345, 0, 6), onGlass: false },
    ];
    for (const [i, s] of spots.entries()) {
      const node = new TransformNode(`glasswortReed${i}`, scene);
      node.position.copyFrom(s.p);
      const f = new Form(scene, "glasswort");
      const blades = s.onGlass ? 26 : 16;
      for (let k = 0; k < blades; k++) {
        const a = r() * Math.PI * 2;
        const d = r() * (s.onGlass ? 1.1 : 0.7);
        const h = 1.2 + r() * 1.1;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        const lean = (r() - 0.5) * 0.3;
        f.branch([[x, 0, z], [x + lean * 0.5, h * 0.6, z], [x + lean, h, z + lean * 0.4]], 0.018, stem);
        // Seed heads glint like the glass they grow in.
        if (r() < 0.45) f.ellipsoid([x + lean, h + 0.1, z + lean * 0.4], [0.05, 0.22, 0.05], tip, 4);
      }
      const meshes = f.finish(node);
      for (const mesh of meshes) mesh.isPickable = true;
      this.clumps.push(node);
      this.scannables.push({
        entryId: "glasswort-reed",
        meshes,
        getPosition: () => node.position.add(new Vector3(0, 1, 0)),
        isConditionMet: () => s.onGlass,
      });
    }
  }

  update(): void {
    const t = performance.now() / 1000;
    const gust = this.ctx.wind.strength;
    for (const [i, c] of this.clumps.entries()) {
      c.rotation.z = Math.sin(t * 1.3 + i) * (0.02 + gust * 0.08);
      c.rotation.x = Math.cos(t * 1.1 + i * 2) * (0.015 + gust * 0.05);
    }
  }
}

// ---------------------------------------------------------------------------
// Gutter Lily: floating leaves that fold shut when the water is disturbed.

const LILY_SPOTS = [
  new Vector3(294.5, 0, 17.2),
  new Vector3(309, 0, 21.8),
  new Vector3(318, 0, 16.2),
  new Vector3(331, 0, 21),
  new Vector3(352, 0, 16.4),
  new Vector3(366, 0, 21.6),
];

class GutterLilies implements LifeForm {
  scannables: Scannable[] = [];
  private readonly patches: { node: TransformNode; pads: Mesh[]; flower: Mesh; open: number; closedOnce: boolean; reopenedAt: number }[] = [];
  private clock = 0;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const pad = organic(scene, "gutter-lily-pad", "#4c6b3a", "leaf");
    pad.backFaceCulling = false;
    const petal = organic(scene, "gutter-lily-petal", "#d8d0b8", "shell");
    const heart = organic(scene, "gutter-lily-heart", "#b8913c", "fur");
    const r = rng(77);
    for (const [i, s] of LILY_SPOTS.entries()) {
      const node = new TransformNode(`gutterLily${i}`, scene);
      node.position.set(s.x, ARCADE.water + 0.02, s.z);
      const pads: Mesh[] = [];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + r();
        const d = 0.45 + r() * 0.5;
        const hinge = new TransformNode(`lilyHinge${i}_${k}`, scene);
        hinge.parent = node;
        hinge.position.set(Math.cos(a) * d * 0.4, 0, Math.sin(a) * d * 0.4);
        hinge.rotation.y = -a + Math.PI / 2;
        // Each leaf is two halves hinged along the midrib; folding lifts both halves.
        for (const side of [-1, 1]) {
          const half = MeshBuilder.CreateDisc(`lilyPad${i}`, { radius: 0.32 + r() * 0.12, tessellation: 12, arc: 0.5 }, scene);
          half.rotation.x = Math.PI / 2;
          half.rotation.y = side < 0 ? 0 : Math.PI;
          half.bakeCurrentTransformIntoVertices();
          half.material = pad;
          half.parent = hinge;
          half.metadata = { side };
          pads.push(half);
        }
      }
      const flower = MeshBuilder.CreateSphere(`lilyFlower${i}`, { diameter: 0.3, segments: 6, slice: 0.6 }, scene);
      flower.scaling.set(1, 0.7, 1);
      flower.rotation.x = Math.PI;
      flower.position.y = 0.1;
      flower.material = petal;
      flower.parent = node;
      const centreBud = MeshBuilder.CreateSphere(`lilyHeart${i}`, { diameter: 0.1, segments: 4 }, scene);
      centreBud.position.y = 0.12;
      centreBud.material = heart;
      centreBud.parent = node;
      const patch = { node, pads, flower, open: 1, closedOnce: false, reopenedAt: -100 };
      this.patches.push(patch);
      this.scannables.push({
        entryId: "gutter-lily",
        meshes: [...pads, flower, centreBud],
        getPosition: () => node.position.add(new Vector3(0, 0.15, 0)),
        isConditionMet: () => patch.closedOnce && patch.open > 0.95 && this.clock - patch.reopenedAt < 10,
      });
    }
  }

  update(dt: number): void {
    this.clock += dt;
    const robot = this.ctx.robot.position;
    const disturbing = waterAt(robot) === "wade" && this.ctx.robotSpeed > 0.4;
    for (const p of this.patches) {
      const near = flat(robot, p.node.position) < 5;
      const before = p.open;
      if (near && disturbing) {
        p.open = Math.max(0, p.open - dt * 2.5);
        if (p.open < 0.3) p.closedOnce = true;
      } else {
        // Reopens slowly once the water is calm.
        p.open = Math.min(1, p.open + dt * 0.22);
        if (before <= 0.95 && p.open > 0.95 && p.closedOnce) p.reopenedAt = this.clock;
      }
      const fold = (1 - p.open) * 1.25;
      for (const m of p.pads) {
        const side = (m.metadata as { side?: number } | null)?.side;
        if (side) m.rotation.x = side * fold;
      }
      p.flower.scaling.set(0.4 + p.open * 0.6, 0.7, 0.4 + p.open * 0.6);
    }
  }
}

// ---------------------------------------------------------------------------
// Shopfront Moss: thick mats on the rolled-down shutters. One has pulled its
// shutter open.

class ShopfrontMoss implements LifeForm {
  scannables: Scannable[];

  constructor(world: FloodedArcade) {
    this.scannables = world.mossShutters.map((s) => ({
      entryId: "shopfront-moss",
      meshes: [s.mesh],
      getPosition: () => s.mesh.position,
      isConditionMet: () => s.pulled,
    }));
  }

  update(): void {}
}

// ---------------------------------------------------------------------------
// Wader Heron: stalks the shallows of the west half and spears fish.

type HeronState = "wade" | "strike" | "fly" | "perch";

class WaderHeron implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly neck: TransformNode;
  private readonly wings: Mesh[];
  private readonly fish: Mesh;
  private state: HeronState = "wade";
  private timer = 12;
  private target = new Vector3(312, 0, 18);
  private flight?: { from: Vector3; to: Vector3; t: number; next: HeronState };
  private static readonly AREA = { x0: 292, x1: 330, z0: 15.5, z1: 22.5 };

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const grey = organic(scene, "heron-grey", "#7d8483", "fur");
    const pale = organic(scene, "heron-pale", "#c9c6b8", "fur");
    const dark = organic(scene, "heron-dark", "#2b2f30", "fur");
    const beak = organic(scene, "heron-beak", "#9b8648");
    const eye = mat(scene, "wildlifeEye", 0.025, 0.035, 0.025, 0.65);
    this.node = new TransformNode("waderHeron", scene);
    const body = new Form(scene, "heron-body");
    body.ellipsoid([0, 1.05, 0], [0.32, 0.36, 0.62], grey);
    body.ellipsoid([0, 1.1, -0.42], [0.2, 0.12, 0.42], dark);
    for (const side of [-1, 1]) {
      body.branch([[side * 0.07, 0.95, 0], [side * 0.07, 0.48, 0.03], [side * 0.07, 0.02, -0.03]], 0.018, beak);
      body.branch([[side * 0.07, 0.02, -0.03], [side * 0.07, 0.01, 0.16]], 0.01, beak);
    }
    const parts = body.finish(this.node);
    // The neck folds down for a strike: a joint at the base of the neck.
    this.neck = new TransformNode("heronNeck", scene);
    this.neck.parent = this.node;
    this.neck.position.set(0, 1.25, 0.42);
    const neck = new Form(scene, "heron-neck");
    neck.branch([[0, 0, 0], [0, 0.32, 0.08], [0, 0.52, 0.02]], 0.06, pale);
    neck.ellipsoid([0, 0.6, 0.06], [0.12, 0.13, 0.17], pale);
    neck.ellipsoid([0, 0.66, 0.0], [0.04, 0.03, 0.2], dark);
    neck.branch([[0, 0.59, 0.14], [0, 0.56, 0.5]], 0.022, beak);
    for (const side of [-1, 1]) neck.ellipsoid([side * 0.06, 0.62, 0.1], [0.025, 0.025, 0.025], eye);
    parts.push(...neck.finish(this.neck));
    this.fish = MeshBuilder.CreateSphere("heronFish", { diameter: 0.2, segments: 4 }, scene);
    this.fish.scaling.set(0.35, 0.4, 1);
    this.fish.parent = this.neck;
    this.fish.position.set(0, 0.56, 0.5);
    this.fish.material = organic(scene, "heron-fish", "#a7a395", "shell");
    this.fish.isVisible = false;
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = MeshBuilder.CreateBox("heronWing", { width: 0.9, height: 0.04, depth: 0.5 }, scene);
      wing.setPivotPoint(new Vector3(-side * 0.45, 0, 0));
      wing.position.set(side * 0.62, 1.15, -0.05);
      wing.material = grey;
      wing.parent = this.node;
      wing.isVisible = false;
      this.wings.push(wing);
    }
    for (const p of [...parts, ...this.wings]) shadows.addShadowCaster(p);
    this.node.position.set(312, 0, 18);
    this.scannables = [
      {
        entryId: "wader-heron",
        meshes: [...parts, ...this.wings],
        getPosition: () => this.node.position.add(new Vector3(0, 1.1, 0)),
        isConditionMet: () => this.state === "strike" && this.timer < 1.6,
      },
    ];
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const d = flat(robot, this.node.position);
    const t = performance.now() / 1000;
    this.timer -= dt;
    const startled = (d < 4 || (d < 9 && this.ctx.robotSpeed > 3)) && Math.abs(robot.y - this.node.position.y) < 3;
    switch (this.state) {
      case "wade": {
        this.neck.rotation.x = Math.sin(t * 0.7) * 0.05;
        if (startled) return this.takeOff();
        const to = this.target.subtract(this.node.position);
        to.y = 0;
        if (to.length() < 0.2) {
          const a = WaderHeron.AREA;
          this.target = new Vector3(a.x0 + Math.random() * (a.x1 - a.x0), 0, a.z0 + Math.random() * (a.z1 - a.z0));
        } else {
          // Slow, deliberate steps with pauses.
          const pace = Math.sin(t * 1.4) > -0.2 ? 0.45 : 0;
          this.node.position.addInPlace(to.normalize().scale(pace * dt));
          this.turnTo(to, dt);
        }
        if (this.timer <= 0) {
          this.state = "strike";
          this.timer = 2.6;
        }
        break;
      }
      case "strike": {
        // Down fast, up slowly with the catch.
        const k = 2.6 - this.timer;
        this.neck.rotation.x = k < 0.35 ? (k / 0.35) * 1.5 : Math.max(0, 1.5 - (k - 0.35) * 1.1);
        this.fish.isVisible = k > 0.35;
        if (startled) {
          this.fish.isVisible = false;
          return this.takeOff();
        }
        if (this.timer <= 0) {
          this.fish.isVisible = false;
          this.state = "wade";
          this.timer = 16 + Math.random() * 14;
          if (d < 25) this.ctx.caption("A splash, and a heron swallowing", 2.5);
        }
        break;
      }
      case "fly":
        this.updateFlight(dt, t);
        break;
      case "perch":
        this.neck.rotation.x = 0;
        if (this.timer <= 0 && d > 10) {
          const a = WaderHeron.AREA;
          this.startFlight(new Vector3(a.x0 + Math.random() * (a.x1 - a.x0), 0, a.z0 + 1 + Math.random() * 5), "wade");
        }
        break;
    }
  }

  private takeOff(): void {
    // Up to the nearest roof edge, away from the robot.
    const robot = this.ctx.robot.position;
    const south = robot.z > this.node.position.z;
    const x = Math.min(330, Math.max(292, this.node.position.x + (this.node.position.x > robot.x ? 8 : -8)));
    this.startFlight(new Vector3(x, ARCADE.roof, south ? ARCADE.shopsS.z0 + 4 : ARCADE.shopsN.z1 - 4), "perch");
    this.ctx.caption("Wingbeats, and an indignant croak", 2.5);
  }

  private startFlight(to: Vector3, next: HeronState): void {
    this.flight = { from: this.node.position.clone(), to, t: 0, next };
    this.state = "fly";
    for (const w of this.wings) w.isVisible = true;
  }

  private updateFlight(dt: number, t: number): void {
    const f = this.flight!;
    f.t = Math.min(1, f.t + dt / (Vector3.Distance(f.from, f.to) / 6 + 0.6));
    const p = Vector3.Lerp(f.from, f.to, f.t);
    p.y += Math.sin(f.t * Math.PI) * 3;
    this.node.position.copyFrom(p);
    this.turnTo(f.to.subtract(f.from), 1);
    const flap = Math.sin(t * 9) * 0.7;
    this.wings[0].rotation.z = flap;
    this.wings[1].rotation.z = -flap;
    if (f.t < 1) return;
    for (const w of this.wings) w.isVisible = false;
    this.state = f.next;
    this.timer = f.next === "perch" ? 20 + Math.random() * 15 : 8 + Math.random() * 8;
  }

  private turnTo(dir: Vector3, k: number): void {
    const yaw = Math.atan2(dir.x, dir.z);
    let d = yaw - this.node.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.node.rotation.y += d * Math.min(1, k * 3);
  }
}

// ---------------------------------------------------------------------------
// Mudskipper Shoal: little fish that climb out onto the shop counters at low sun.

class MudskipperShoals implements LifeForm {
  scannables: Scannable[] = [];
  private readonly shoals: { counter: Vector3; fish: TransformNode[]; out: number }[] = [];

  constructor(private readonly ctx: GameContext, world: FloodedArcade) {
    const scene = ctx.scene;
    const skin = organic(scene, "mudskipper-skin", "#6b6249", "shell");
    const r = rng(9);
    // Two shoals, at counters on either side of the crossing.
    const pick = [
      world.counters.reduce((a, b) => (Math.abs(b.x - 322) < Math.abs(a.x - 322) ? b : a)),
      world.counters.reduce((a, b) => (Math.abs(b.x - 362) < Math.abs(a.x - 362) ? b : a)),
    ];
    for (const counter of pick) {
      const fish: TransformNode[] = [];
      const meshes: Mesh[] = [];
      for (let i = 0; i < 7; i++) {
        const node = new TransformNode("mudskipper", scene);
        const f = new Form(scene, "mudskipper");
        // One material per fish keeps the shoal to a handful of draw calls.
        f.ellipsoid([0, 0.04, 0], [0.07, 0.06, 0.2], skin, 6);
        for (const side of [-1, 1]) {
          f.ellipsoid([side * 0.03, 0.09, 0.07], [0.028, 0.028, 0.028], skin, 4);
          const pec = f.ellipsoid([side * 0.06, 0.02, 0.03], [0.07, 0.01, 0.05], skin, 4);
          pec.rotation.z = side * 0.4;
        }
        f.ellipsoid([0, 0.07, -0.05], [0.01, 0.05, 0.1], skin, 4);
        const parts = f.finish(node);
        meshes.push(...parts);
        node.metadata = { dx: (r() - 0.5) * 2.6, dz: (r() - 0.5) * 0.5, phase: r() * 6, yaw: r() * Math.PI * 2 };
        fish.push(node);
      }
      const shoal = { counter, fish, out: 0 };
      this.shoals.push(shoal);
      this.scannables.push({
        entryId: "mudskipper-shoal",
        meshes,
        getPosition: () => fish[0].position,
        isConditionMet: () => shoal.out > 0.9,
      });
    }
  }

  update(dt: number): void {
    const want = lowSun(this.ctx.time.hours) ? 1 : 0;
    const t = performance.now() / 1000;
    for (const s of this.shoals) {
      s.out += Math.sign(want - s.out) * Math.min(Math.abs(want - s.out), dt * 0.25);
      // In the water in front of the counter, or up on its top.
      const front = s.counter.z < ARCADE_AXIS ? 1 : -1;
      for (const f of s.fish) {
        const md = f.metadata as { dx: number; dz: number; phase: number; yaw: number };
        const hop = Math.max(0, Math.sin(t * 2.2 + md.phase)) * 0.12;
        const yWater = ARCADE.water - 0.03;
        const y = yWater + (s.counter.y - yWater) * s.out + hop * s.out;
        const z = s.counter.z + md.dz + (1 - s.out) * front * 1.2;
        f.position.set(s.counter.x + md.dx, y, z);
        f.rotation.y = md.yaw + Math.sin(t * 0.5 + md.phase) * 0.6;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Snapping Eel: the danger. Patrols the canal; anyone wading through its shallows
// gets snatched and dragged back to the bank.

type EelState = "patrol" | "hunt" | "warn" | "rest";

class SnappingEel implements LifeForm {
  scannables: Scannable[];
  private readonly segments: Mesh[] = [];
  private readonly fin: Mesh;
  private readonly path: Vector3[] = [];
  private readonly ripple: Mesh;
  private readonly rippleMat: StandardMaterial;
  private state: EelState = "patrol";
  private timer = 30;
  private head = new Vector3(340, 0.2, 30);
  private goal = new Vector3(340, 0.2, 0);
  private static readonly SEGMENTS = 12;
  private static readonly SPACING = 0.32;

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const skin = organic(scene, "snapping-eel-skin", "#3a4031", "shell");
    skin.specularColor = new Color3(0.25, 0.25, 0.2);
    const belly = organic(scene, "snapping-eel-head", "#4a4436", "shell");
    const finMat = organic(scene, "snapping-eel-fin", "#5b4a33", "leaf");
    finMat.backFaceCulling = false;
    for (let i = 0; i < SnappingEel.SEGMENTS; i++) {
      const t = i / (SnappingEel.SEGMENTS - 1);
      const d = i === 0 ? 0.42 : 0.4 * (1 - t * 0.7);
      const seg = MeshBuilder.CreateSphere("eelSegment", { diameter: 1, segments: 6 }, scene);
      seg.scaling.set(d, d * 0.8, i === 0 ? 0.75 : 0.5);
      seg.material = i === 0 ? belly : skin;
      seg.isPickable = true;
      shadows.addShadowCaster(seg);
      this.segments.push(seg);
    }
    // The fin that breaks the surface: the warning.
    this.fin = MeshBuilder.CreatePlane("eelFin", { width: 1.1, height: 0.3 }, scene);
    this.fin.material = finMat;
    this.rippleMat = mat(scene, "eelRipple", 0.85, 0.9, 0.88, 0.4);
    this.rippleMat.alpha = 0;
    this.ripple = MeshBuilder.CreateTorus("eelRipple", { diameter: 2, thickness: 0.06, tessellation: 24 }, scene);
    this.ripple.material = this.rippleMat;
    this.ripple.isPickable = false;
    for (let i = 0; i < SnappingEel.SEGMENTS * 4; i++) this.path.push(this.head.add(new Vector3(0, 0, i * SnappingEel.SPACING / 4)));
    this.scannables = [
      {
        entryId: "snapping-eel",
        meshes: [...this.segments, this.fin],
        getPosition: () => this.segments[2].position,
        // Watched from above: from the girders or the roof edge.
        isConditionMet: () => this.ctx.robot.position.y > ARCADE.roof - 1.5 && flat(this.ctx.robot.position, this.head) < 18,
      },
    ];
  }

  /** Robot wading in the canal or its shallows. */
  private robotInReach(): boolean {
    const p = this.ctx.robot.position;
    return waterAt(p) === "wade" && p.x > ARCADE.crossing.x0 - 0.3 && p.x < ARCADE.crossing.x1 + 0.3;
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const t = performance.now() / 1000;
    this.timer -= dt;
    let speed = 1.6;
    switch (this.state) {
      case "patrol":
        if (flat(this.head, this.goal) < 1) this.goal = new Vector3(340 + (Math.random() - 0.5) * 4, 0.2, Math.random() < 0.5 ? 2 + Math.random() * 10 : 26 + Math.random() * 12);
        if (this.robotInReach() && flat(robot, this.head) < 20) {
          this.state = "warn";
          this.timer = 1.4;
          this.ctx.caption("Ripples. Something long is moving in the canal.", 2.5);
          break;
        }
        if (this.timer <= 0) {
          // Off to chase fish at one end of the canal.
          this.state = "hunt";
          this.timer = 11;
          this.goal = new Vector3(340, 0.2, Math.random() < 0.5 ? ARCADE.canal.z0 + 2 : ARCADE.canal.z1 - 2);
        }
        break;
      case "hunt":
        speed = 3;
        if (flat(this.head, this.goal) < 1.5) {
          // Thrashing after fish: splashes at the far end.
          this.goal = this.goal.add(new Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
          this.goal.x = Math.min(ARCADE.canal.x1 - 1, Math.max(ARCADE.canal.x0 + 1, this.goal.x));
        }
        if (this.timer <= 0) {
          this.state = "patrol";
          this.timer = 25 + Math.random() * 15;
        }
        break;
      case "warn":
        speed = 4.5;
        this.goal = new Vector3(robot.x, 0.2, robot.z);
        if (!this.robotInReach()) {
          this.state = "patrol";
          break;
        }
        if (this.timer <= 0) this.strike();
        break;
      case "rest":
        speed = 0.8;
        if (this.timer <= 0) {
          this.state = "patrol";
          this.timer = 20 + Math.random() * 15;
        }
        break;
    }
    // Swim towards the goal, keeping to the canal and the shallows.
    const to = this.goal.subtract(this.head);
    to.y = 0;
    const len = to.length();
    if (len > 0.05) this.head.addInPlace(to.scale(Math.min(1, (speed * dt) / len)));
    this.head.x = Math.min(ARCADE.crossing.x1 - 0.4, Math.max(ARCADE.crossing.x0 + 0.4, this.head.x));
    this.head.z = Math.min(ARCADE.canal.z1 - 0.5, Math.max(ARCADE.canal.z0 + 0.5, this.head.z));
    // Body follows the head's trail, waving side to side.
    const last = this.path[0];
    if (Vector3.Distance(last, this.head) > SnappingEel.SPACING / 4) this.path.unshift(this.head.clone());
    while (this.path.length > SnappingEel.SEGMENTS * 4 + 1) this.path.pop();
    const surfacing = this.state === "warn" || this.state === "hunt" ? 0.12 : 0;
    for (const [i, seg] of this.segments.entries()) {
      const p = this.path[Math.min(this.path.length - 1, i * 4)];
      const next = this.path[Math.min(this.path.length - 1, i * 4 + 4)];
      const wave = Math.sin(t * 5 - i * 0.7) * 0.12 * (i / this.segments.length);
      seg.position.set(p.x + wave, ARCADE.water - 0.24 + surfacing, p.z);
      seg.rotation.y = Math.atan2(p.x - next.x, p.z - next.z);
    }
    const s2 = this.segments[3];
    this.fin.position.set(s2.position.x, ARCADE.water + 0.08 + surfacing, s2.position.z);
    this.fin.rotation.y = s2.rotation.y + Math.PI / 2;
    // Ripples while warning or hunting.
    if (this.state === "warn" || this.state === "hunt") {
      const k = (t * 1.5) % 1;
      this.ripple.position.set(this.head.x, ARCADE.water + 0.01, this.head.z);
      this.ripple.scaling.setAll(0.5 + k * 1.5);
      this.rippleMat.alpha = (1 - k) * 0.5;
      this.ripple.isVisible = true;
    } else {
      this.ripple.isVisible = false;
    }
  }

  private strike(): void {
    const robot = this.ctx.robot;
    const p = robot.position;
    // Dragged back to whichever bank it came from.
    const west = p.x < (ARCADE.crossing.x0 + ARCADE.crossing.x1) / 2;
    const z = Math.min(22.5, Math.max(16.8, p.z));
    robot.teleport(new Vector3(west ? ARCADE.crossing.x0 - 2.5 : ARCADE.crossing.x1 + 2.8, 0, z), west ? -Math.PI / 2 : Math.PI / 2);
    this.ctx.status.energy = Math.max(0, this.ctx.status.energy - 35);
    this.ctx.caption("SNAP! Seized and dragged back to the bank.", 3);
    this.state = "rest";
    this.timer = 6;
    this.goal = new Vector3(340, 0.2, Math.random() < 0.5 ? 6 : 32);
  }
}

// ---------------------------------------------------------------------------
// Human artifacts, the Flood Line and the Predecessor's tracks (static, scan once).

export function createArcadeDiscoveries(ctx: GameContext, world: FloodedArcade): Scannable[] {
  const near = (meshes: Mesh[], range: number) => () => flat(ctx.robot.position, meshes[0].getBoundingInfo().boundingBox.centerWorld) < range;
  return [
    { entryId: "art-arcade-clock", meshes: world.clock, getPosition: centre(world.clock[0]) },
    { entryId: "art-flood-line", meshes: world.floodLine, getPosition: centre(world.floodLine[1]), isAvailable: near(world.floodLine, 9) },
    { entryId: "art-shop-shutter", meshes: world.shutter, getPosition: centre(world.shutter[0]) },
    { entryId: "art-bicycle-rack", meshes: world.bikeRack, getPosition: centre(world.bikeRack[0]) },
    { entryId: "art-toy-boat", meshes: world.toyBoat, getPosition: centre(world.toyBoat[0]) },
    { entryId: "origin-tracks", meshes: world.tracks, getPosition: centre(world.tracks[0]) },
  ];
}
