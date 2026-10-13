import { AbstractMesh, Color3, Mesh, MeshBuilder, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { ARCADE, ARCADE_AXIS, waterAt, type FloodedArcade } from "../floodedArcade";
import { rng } from "../textures";
import { mat } from "./materials";
import { cutout, Form, organic } from "./visuals";

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
    // Glasswort Reed photo: dense, tall straw-coloured blades, green at the foot, with pale plumes.
    const blades = cutout(scene, "glasswort-reed", 512, reedCard);
    const stem = organic(scene, "glasswort-stem", "#a49564", "leaf");
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
      const w = s.onGlass ? 2.4 : 1.7;
      const h = s.onGlass ? 2.5 : 2.1;
      // Three crossed cards make the bed; a few solid blades in front give it depth.
      for (let k = 0; k < 3; k++) f.plane([0, h / 2, 0], [w, h], [0, (k / 3) * Math.PI + r() * 0.3, 0], blades);
      for (let k = 0; k < 7; k++) {
        const a = r() * Math.PI * 2, d = 0.2 + r() * w * 0.35, x = Math.cos(a) * d, z = Math.sin(a) * d;
        const tall = h * (0.7 + r() * 0.35), lean = (r() - 0.5) * 0.5;
        f.taper([[x, 0, z], [x + lean * 0.3, tall * 0.6, z], [x + lean, tall, z + lean * 0.3]], 0.018, 0.004, stem, 4);
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
    // Gutter Lily photo: broad pads, some green and some rust-red, around a white water-lily with a gold heart.
    const pads = [organic(scene, "gutter-lily-pad", "#3f5c2c", "leaf"), organic(scene, "gutter-lily-pad-red", "#6e3526", "leaf")];
    for (const p of pads) p.backFaceCulling = false;
    const petal = organic(scene, "gutter-lily-petal", "#f1ece0", "shell");
    const heart = organic(scene, "gutter-lily-heart", "#d9a93a", "fur");
    const r = rng(77);
    for (const [i, s] of LILY_SPOTS.entries()) {
      const node = new TransformNode(`gutterLily${i}`, scene);
      node.position.set(s.x, ARCADE.water + 0.02, s.z);
      const halves: Mesh[] = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r();
        const d = 0.55 + r() * 0.5;
        const hinge = new TransformNode(`lilyHinge${i}_${k}`, scene);
        hinge.parent = node;
        hinge.position.set(Math.cos(a) * d * 0.6, 0, Math.sin(a) * d * 0.6);
        hinge.rotation.y = -a + Math.PI / 2;
        const radius = 0.42 + r() * 0.22;
        const padMat = pads[r() < 0.45 ? 1 : 0];
        // Each leaf is two halves hinged along the midrib; folding lifts both halves.
        // A sliver is left out of one half: the notch every lily pad has.
        for (const side of [-1, 1]) {
          const half = MeshBuilder.CreateDisc(`lilyPad${i}`, { radius, tessellation: 14, arc: side < 0 ? 0.5 : 0.46 }, scene);
          half.rotation.x = Math.PI / 2;
          half.rotation.y = side < 0 ? 0 : Math.PI;
          half.bakeCurrentTransformIntoVertices();
          half.material = padMat;
          half.parent = hinge;
          half.metadata = { side };
          halves.push(half);
        }
      }
      // The flower: two rings of pointed petals opening out of a gold heart.
      const parts: Mesh[] = [];
      for (const [ring, n, len, tilt] of [[0, 9, 0.2, 0.45], [1, 8, 0.16, 0.95]] as const) {
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + ring * 0.35;
          const p = MeshBuilder.CreateSphere(`lilyFlower${i}`, { diameter: 1, segments: 3 }, scene);
          p.scaling.set(0.075, 0.025, len);
          p.setPivotPoint(new Vector3(0, 0, -0.5));
          p.position.set(Math.sin(a) * (0.03 + len * 0.15), 0.02 + ring * 0.03, Math.cos(a) * (0.03 + len * 0.15));
          p.rotation.set(-tilt, a, 0);
          parts.push(p);
        }
      }
      const flower = Mesh.MergeMeshes(parts, true)!;
      flower.name = `lilyFlower${i}`;
      flower.material = petal;
      flower.parent = node;
      const centreBud = MeshBuilder.CreateSphere(`lilyHeart${i}`, { diameter: 0.11, segments: 5 }, scene);
      centreBud.scaling.y = 0.6;
      centreBud.position.y = 0.06;
      centreBud.material = heart;
      centreBud.parent = node;
      const patch = { node, pads: halves, flower, open: 1, closedOnce: false, reopenedAt: -100 };
      this.patches.push(patch);
      this.scannables.push({
        entryId: "gutter-lily",
        meshes: [...halves, flower, centreBud],
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
      p.flower.scaling.set(0.4 + p.open * 0.6, 0.6 + p.open * 0.4, 0.4 + p.open * 0.6);
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
    // Wader Heron photo: a grey heron. Ash-grey back and folded wings with dark flight feathers, white
    // neck in a tall S, black crest plume, long yellow dagger bill, long yellowish legs.
    const grey = organic(scene, "heron-grey", "#8a908f", "feather");
    const wingGrey = organic(scene, "heron-wing", "#6b7273", "feather");
    const pale = organic(scene, "heron-pale", "#e2e0d6", "feather");
    const dark = organic(scene, "heron-dark", "#24282a", "feather");
    const beak = organic(scene, "heron-beak", "#c9a243", "shell");
    const legs = organic(scene, "heron-legs", "#9c8a5a", "scales");
    const eye = mat(scene, "wildlifeEye", 0.025, 0.035, 0.025, 0.65);
    this.node = new TransformNode("waderHeron", scene);
    const body = new Form(scene, "heron-body");
    body.ellipsoid([0, 1.02, -0.02], [0.3, 0.34, 0.7], grey).rotation.x = -0.35;
    body.ellipsoid([0, 1.08, 0.24], [0.24, 0.3, 0.3], pale).rotation.x = -0.4;
    for (const side of [-1, 1]) {
      // Folded wing, its dark primaries crossing over the tail.
      body.ellipsoid([side * 0.13, 1.04, -0.08], [0.08, 0.3, 0.66], wingGrey).rotation.x = -0.3;
      body.ellipsoid([side * 0.08, 0.92, -0.45], [0.06, 0.08, 0.34], dark).rotation.x = -0.15;
      // Black shoulder patch.
      body.ellipsoid([side * 0.12, 1.18, 0.28], [0.06, 0.1, 0.1], dark, 6);
      body.taper([[side * 0.07, 0.95, 0], [side * 0.07, 0.5, 0.04], [side * 0.07, 0.03, -0.02]], 0.03, 0.016, legs, 5);
      for (const toe of [-0.5, 0, 0.5]) body.taper([[side * 0.07, 0.02, -0.02], [side * 0.07 + Math.sin(toe) * 0.14, 0.01, -0.02 + Math.cos(toe) * 0.14]], 0.012, 0.006, legs, 4);
    }
    const parts = body.finish(this.node);
    // The neck folds down for a strike: a joint at the base of the neck.
    this.neck = new TransformNode("heronNeck", scene);
    this.neck.parent = this.node;
    this.neck.position.set(0, 1.18, 0.36);
    const neck = new Form(scene, "heron-neck");
    neck.taper([[0, -0.05, -0.04], [0, 0.18, 0.13], [0, 0.36, 0.1], [0, 0.48, -0.01], [0, 0.6, 0.04]], 0.085, 0.045, pale, 7);
    // Black streaks down the front of the neck.
    neck.taper([[0, 0.12, 0.2], [0, 0.32, 0.17], [0, 0.44, 0.06]], 0.012, 0.006, dark, 4);
    neck.ellipsoid([0, 0.64, 0.08], [0.1, 0.1, 0.18], pale);
    neck.ellipsoid([0, 0.68, 0.04], [0.11, 0.04, 0.17], dark, 6);
    neck.taper([[0, 0.68, -0.03], [0, 0.66, -0.2], [0, 0.6, -0.32]], 0.016, 0.003, dark, 4);
    neck.taper([[0, 0.63, 0.15], [0, 0.6, 0.5]], 0.03, 0.004, beak, 6);
    for (const side of [-1, 1]) neck.ellipsoid([side * 0.045, 0.655, 0.12], [0.022, 0.022, 0.022], eye, 5);
    parts.push(...neck.finish(this.neck));
    this.fish = MeshBuilder.CreateSphere("heronFish", { diameter: 0.2, segments: 4 }, scene);
    this.fish.scaling.set(0.35, 0.4, 1);
    this.fish.parent = this.neck;
    this.fish.position.set(0, 0.6, 0.5);
    this.fish.material = organic(scene, "heron-fish", "#a7a395", "shell");
    this.fish.isVisible = false;
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = MeshBuilder.CreateBox("heronWing", { width: 1.1, height: 0.03, depth: 0.55 }, scene);
      wing.setPivotPoint(new Vector3(-side * 0.55, 0, 0));
      wing.position.set(side * 0.7, 1.15, -0.05);
      wing.material = wingGrey;
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
    const skin = organic(scene, "mudskipper-skin", "#6a5c45", "scales");
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
        // Mudskipper photo: speckled tan body with a blunt head, bulging eyes on top, two sail fins,
        // and pectoral fins it walks on. One material per fish keeps the shoal to a handful of draw calls.
        f.taper([[0, 0.055, 0.12], [0, 0.06, 0.03], [0, 0.05, -0.08], [0, 0.04, -0.18]], 0.06, 0.014, skin, 5);
        f.ellipsoid([0, 0.055, 0.13], [0.12, 0.1, 0.14], skin, 3);
        for (const side of [-1, 1]) {
          f.ellipsoid([side * 0.025, 0.115, 0.15], [0.042, 0.05, 0.042], skin, 3);
          const pec = f.ellipsoid([side * 0.07, 0.02, 0.07], [0.08, 0.015, 0.06], skin, 3);
          pec.rotation.z = side * 0.5;
        }
        f.ellipsoid([0, 0.12, 0.02], [0.008, 0.08, 0.09], skin, 3);
        f.ellipsoid([0, 0.09, -0.08], [0.008, 0.05, 0.1], skin, 3);
        f.ellipsoid([0, 0.04, -0.22], [0.008, 0.07, 0.07], skin, 3);
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
    // Snapping Eel photo: a thick, dark, glossy body mottled lighter, a broad flat head with a heavy
    // jaw, and a low ribbed fin running along the back.
    const skin = organic(scene, "snapping-eel-skin", "#2c2e25", "scales");
    skin.specularColor = new Color3(0.12, 0.12, 0.1);
    const finMat = cutout(scene, "snapping-eel-fin", 256, eelFin);
    for (let i = 0; i < SnappingEel.SEGMENTS; i++) {
      const t = i / (SnappingEel.SEGMENTS - 1);
      const d = 0.44 * (1 - t * 0.75);
      const f = new Form(scene, "eelSegment");
      if (i === 0) {
        // Head: flat and wide, the lower jaw slightly open, small eyes high on the skull.
        f.ellipsoid([0, 0.02, 0.02], [0.42, 0.26, 0.62], skin);
        f.ellipsoid([0, -0.08, 0.1], [0.34, 0.12, 0.5], skin, 6).rotation.x = 0.12;
        for (const side of [-1, 1]) f.ellipsoid([side * 0.15, 0.12, 0.14], [0.06, 0.05, 0.06], skin, 5);
      } else {
        // Long overlapping sections so the body reads as one rope, not beads.
        f.ellipsoid([0, 0, 0], [d, d * 0.85, SnappingEel.SPACING * 2.8], skin, 7);
        if (i > 1) f.ellipsoid([0, d * 0.42, 0], [0.025, d * 0.45, SnappingEel.SPACING * 1.6], skin, 4);
      }
      const seg = f.finish()[0];
      seg.name = "eelSegment";
      seg.isPickable = true;
      shadows.addShadowCaster(seg);
      this.segments.push(seg);
    }
    // The fin that breaks the surface: the warning.
    this.fin = MeshBuilder.CreatePlane("eelFin", { width: 1.1, height: 0.3, sideOrientation: Mesh.DOUBLESIDE }, scene);
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

// ---------------------------------------------------------------------------
// Painted cut-outs.

/** Reed bed card: blades rising from the foot, green below and straw above, some with pale plumes. */
function reedCard(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  for (let i = 0; i < 150; i++) {
    const x = s * (0.08 + r() * 0.84), top = s * (0.02 + r() * 0.4), bend = (r() - 0.5) * s * 0.25;
    const g = c.createLinearGradient(0, s, 0, top);
    const k = r();
    g.addColorStop(0, `rgb(${70 + k * 20},${86 + k * 20},${44})`);
    g.addColorStop(0.45, `rgb(${120 + k * 40},${124 + k * 30},${70 + k * 10})`);
    g.addColorStop(1, `rgb(${196 + k * 30},${178 + k * 26},${122 + k * 20})`);
    c.fillStyle = g;
    const wd = 2 + r() * 4;
    c.beginPath();
    c.moveTo(x - wd, s);
    c.quadraticCurveTo(x + bend * 0.3, (s + top) / 2, x + bend, top);
    c.quadraticCurveTo(x + bend * 0.3 + wd * 0.4, (s + top) / 2, x + wd, s);
    c.fill();
    if (r() < 0.3) {
      // Feathery seed plume.
      c.fillStyle = `rgba(${215 + k * 25},${200 + k * 20},${160},0.95)`;
      for (let j = 0; j < 14; j++) {
        c.beginPath();
        c.ellipse(x + bend + (r() - 0.5) * 8, top + j * 3 - 6, 2.5, 5, (r() - 0.5) * 0.8, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
}

/** The snapping eel's dorsal fin, ribbed, for the part that breaks the surface. */
function eelFin(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  c.fillStyle = "#2f3027";
  c.beginPath();
  c.moveTo(0, s * 0.95);
  c.quadraticCurveTo(s * 0.15, s * 0.2, s * 0.45, s * 0.12);
  c.quadraticCurveTo(s * 0.8, s * 0.2, s, s * 0.95);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(110,98,70,.6)";
  c.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x = s * (0.05 + i * 0.05);
    c.beginPath(); c.moveTo(x, s * 0.95); c.lineTo(x + s * 0.06 + r() * 4, s * (0.2 + Math.abs(i - 8) * 0.04)); c.stroke();
  }
}
