import { AbstractMesh, Color3, Mesh, PointLight, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { STATION, type SunkenStation } from "../sunkenStation";
import { rng } from "../textures";
import { mat } from "./materials";
import { cutout, Form, organic } from "./visuals";

/** Sunken Station species (docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md). No glow anywhere down here. */
export function createStationLife(ctx: GameContext, shadows: ShadowGenerator, world: SunkenStation): LifeForm[] {
  return [
    new ShaftLight(ctx, world),
    new RootCurtains(ctx),
    new ShaftFerns(ctx),
    new CaveSwifts(ctx, world),
    new TicketBeetles(ctx, world),
    new PaleCrayfish(ctx),
    new TunnelHound(ctx, shadows),
  ];
}

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

/** Inside the platform level's floor plan (platform, tunnel and den), at floor height. */
const FLOOR = STATION.platform.floor;

// ---------------------------------------------------------------------------
// The light shafts: dusty beams that follow the daylight outside.

class ShaftLight implements LifeForm {
  scannables: Scannable[] = [];
  private readonly material: StandardMaterial;
  private readonly lights: PointLight[] = [];

  constructor(private readonly ctx: GameContext, world: SunkenStation) {
    this.material = world.beams[0].material as StandardMaterial;
    // Daylight falling down each shaft. Each light only touches the station meshes near its shaft,
    // so no material ever has more than the sun, the sky and one of these.
    const station = ctx.scene.meshes.filter((m) => m.name.startsWith("kit:") || m.name.startsWith("rootColumn") || m.name.startsWith("shaftFern") || m.name.startsWith("rootCurtain"));
    for (const [i, s] of STATION.shafts.entries()) {
      const floor = i === 0 ? STATION.hall.floor : FLOOR;
      const light = new PointLight(`shaftLight${i}`, new Vector3((s.x0 + s.x1) / 2, floor + 4.5, (s.z0 + s.z1) / 2), ctx.scene);
      light.diffuse = new Color3(1, 0.93, 0.8);
      light.specular = new Color3(0.2, 0.19, 0.16);
      light.range = 11;
      light.intensity = 0;
      const reach = (m: AbstractMesh) => {
        const b = m.getBoundingInfo().boundingBox;
        return b.minimumWorld.x < s.x1 + 10 && b.maximumWorld.x > s.x0 - 10 && b.minimumWorld.z < s.z1 + 10 && b.maximumWorld.z > s.z0 - 10 && b.minimumWorld.y < floor + 6 && b.maximumWorld.y > floor - 2;
      };
      light.includedOnlyMeshes = station.filter(reach);
      this.lights.push(light);
    }
  }

  update(): void {
    const day = this.ctx.time.daylight;
    // Stepped, so the material only changes now and then.
    const alpha = Math.round((0.012 + 0.06 * day) * 200) / 200;
    if (this.material.alpha !== alpha) this.material.alpha = alpha;
    for (const l of this.lights) l.intensity = 0.15 + 1.6 * day;
  }
}

// ---------------------------------------------------------------------------
// Root Curtain: pale roots hanging from the ceiling. Where the tips reach a drip pool, the observation.

class RootCurtains implements LifeForm {
  scannables: Scannable[] = [];
  private readonly curtains: { mesh: Mesh; phase: number }[] = [];
  private clock = 0;

  constructor(ctx: GameContext) {
    const scene = ctx.scene;
    const material = cutout(scene, "root-curtain", 256, rootCurtainCard);
    const r = rng(611);
    const p = STATION.platform;
    const tunnelCeiling = STATION.tunnel.ceiling;
    // Over each pool the tips reach the water; the rest still hang short of the floor.
    const spots: { x: number; z: number; top: number; bottom: number; reaches: boolean }[] = [
      ...STATION.pools.map((pool) => ({ x: pool.x, z: pool.z, top: pool.lit ? p.ceiling : tunnelCeiling, bottom: FLOOR + 0.03, reaches: true })),
      { x: 486, z: 3.2, top: p.ceiling, bottom: FLOOR + 2.6, reaches: false },
      { x: 498.5, z: 0.4, top: p.ceiling, bottom: FLOOR + 3.4, reaches: false },
      { x: 437.5, z: 5.2, top: STATION.hall.ceiling, bottom: STATION.hall.floor + 1.6, reaches: false },
    ];
    for (const s of spots) {
      const f = new Form(scene, "rootCurtain");
      const h = s.top - s.bottom;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI + r() * 0.3;
        const w = 1 + r() * 0.5;
        f.plane([s.x + (r() - 0.5) * 0.4, s.bottom + h / 2, s.z + (r() - 0.5) * 0.4], [w, h], [0, a, 0], material);
      }
      const mesh = f.finish()[0];
      mesh.setPivotPoint(new Vector3(s.x, s.top, s.z));
      this.curtains.push({ mesh, phase: r() * 6 });
      this.scannables.push({
        entryId: "root-curtain",
        meshes: [mesh],
        getPosition: () => new Vector3(s.x, Math.max(s.bottom + 1, s.top - 2), s.z),
        isConditionMet: () => s.reaches,
      });
    }
  }

  update(dt: number): void {
    // A slow sway in the draught from the shafts.
    this.clock += dt;
    for (const c of this.curtains) c.mesh.rotation.z = Math.sin(this.clock * 0.4 + c.phase) * 0.012;
  }
}

// ---------------------------------------------------------------------------
// Shaft Fern: grows only in the shafts' light, and unrolls its fronds only around noon.

class ShaftFerns implements LifeForm {
  scannables: Scannable[] = [];
  private readonly clumps: { node: TransformNode; open: number }[] = [];

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const frond = cutout(scene, "shaft-fern", 256, fernFrondCard);
    const r = rng(733);
    for (const [i, s] of STATION.shafts.entries()) {
      const floor = i === 0 ? STATION.hall.floor : FLOOR;
      for (let k = 0; k < 2; k++) {
        const node = new TransformNode("shaftFern", scene);
        node.position.set(s.x0 + 0.9 + r() * (s.x1 - s.x0 - 1.8), floor + 0.2, s.z0 + 0.9 + r() * (s.z1 - s.z0 - 1.8));
        const f = new Form(scene, "shaftFern");
        for (let j = 0; j < 9; j++) {
          const a = (j / 9) * Math.PI * 2 + r() * 0.3;
          const len = 0.7 + r() * 0.35;
          // Each frond leans out from the crown.
          const m = f.plane([Math.sin(a) * len * 0.35, len * 0.42, Math.cos(a) * len * 0.35], [0.36, len], [0, a, 0], frond);
          m.rotation.x = 0.75;
          m.rotation.y = a;
        }
        const parts = f.finish(node);
        const clump = { node, open: 0 };
        this.clumps.push(clump);
        this.scannables.push({
          entryId: "shaft-fern",
          meshes: parts,
          getPosition: () => node.position.add(new Vector3(0, 0.4, 0)),
          isConditionMet: () => clump.open > 0.85,
        });
      }
    }
  }

  update(dt: number): void {
    const h = this.ctx.time.hours;
    // Direct light reaches the bottom of a shaft only with the sun high.
    const want = h >= 10.5 && h < 13.5 && this.ctx.time.daylight > 0.5 ? 1 : 0;
    for (const c of this.clumps) {
      c.open += Math.sign(want - c.open) * Math.min(Math.abs(want - c.open), dt * 0.25);
      // Curled: small and tight. Open: spread wide.
      const s = 0.45 + c.open * 0.55;
      c.node.scaling.set(s * (0.6 + c.open * 0.4), s, s * (0.6 + c.open * 0.4));
    }
  }
}

// ---------------------------------------------------------------------------
// Cave Swift: roosts over the east tunnel mouth by day, streams out up the far shaft at dusk.

type SwiftState = "nest" | "out" | "gone" | "in";

class CaveSwifts implements LifeForm {
  scannables: Scannable[] = [];
  private readonly birds: { node: TransformNode; wings: Mesh[]; nest: Vector3; state: SwiftState; t: number; wait: number }[] = [];
  private announced = false;
  private static readonly ROUTE = (nest: Vector3) => {
    const shaft = STATION.shafts[2];
    const sx = (shaft.x0 + shaft.x1) / 2, sz = (shaft.z0 + shaft.z1) / 2;
    return [nest, new Vector3(552, -9.6, 5), new Vector3(540, -9.2, 3), new Vector3(sx, -9, sz), new Vector3(sx, -2, sz), new Vector3(sx + 3, 6, sz)];
  };

  constructor(private readonly ctx: GameContext, world: SunkenStation) {
    const scene = ctx.scene;
    // Sooty brown-black, long swept wings, a pale throat.
    const sooty = organic(scene, "swift-sooty", "#2b2a28", "feather");
    const throat = organic(scene, "swift-throat", "#6d665b", "feather");
    for (const [i, nest] of world.nests.entries()) {
      const node = new TransformNode("caveSwift", scene);
      const f = new Form(scene, "swift-body");
      f.ellipsoid([0, 0, 0], [0.07, 0.07, 0.17], sooty, 6);
      f.ellipsoid([0, -0.012, 0.05], [0.045, 0.04, 0.05], throat, 5);
      f.taper([[0, 0, -0.08], [0, 0.005, -0.16]], 0.025, 0.004, sooty, 4);
      const parts = f.finish(node);
      const wings: Mesh[] = [];
      for (const side of [-1, 1]) {
        const w = new Form(scene, "swift-wing");
        // A long scythe: out to the side, swept back.
        w.taper([[0, 0, 0.02], [side * 0.12, 0.005, -0.02], [side * 0.22, 0, -0.1]], 0.025, 0.006, sooty, 4);
        const wing = w.finish(node)[0];
        wings.push(wing);
      }
      node.position.copyFrom(nest);
      node.rotation.y = -Math.PI / 2;
      this.birds.push({ node, wings, nest, state: "nest", t: 0, wait: i * 9 });
      this.scannables.push({
        entryId: "cave-swift",
        meshes: [...parts, ...wings],
        getPosition: () => node.position,
        isAvailable: () => node.isEnabled(),
        isConditionMet: () => this.leaving(),
      });
    }
  }

  private leaving(): boolean {
    const h = this.ctx.time.hours;
    return h >= 18.5 && h < 20;
  }

  update(dt: number): void {
    const h = this.ctx.time.hours;
    const leaving = this.leaving();
    const night = h >= 20 || h < 4.5;
    const returning = h >= 4.5 && h < 5.5;
    const now = performance.now() / 1000;
    if (leaving && !this.announced && flat(this.ctx.robot.position, new Vector3(545, 0, 4)) < 40) {
      this.announced = true;
      this.ctx.caption("A rush of wings: twittering pours out of the tunnel mouth.", 3);
    }
    if (!leaving) this.announced = false;
    for (const [i, b] of this.birds.entries()) {
      switch (b.state) {
        case "nest":
          b.node.setEnabled(true);
          b.node.position.copyFrom(b.nest);
          for (const w of b.wings) w.rotation.z = 0;
          // At dusk they leave one after another, then come back round for another pass.
          if (leaving && (b.wait -= dt) <= 0) {
            b.state = "out";
            b.t = 0;
          }
          if (night) b.state = "gone";
          break;
        case "out":
        case "in": {
          b.t += dt / 7;
          const route = CaveSwifts.ROUTE(b.nest);
          const k = b.state === "out" ? b.t : 1 - b.t;
          const p = along(route, Math.min(1, Math.max(0, k)));
          const ahead = along(route, Math.min(1, Math.max(0, k + (b.state === "out" ? 0.02 : -0.02))));
          b.node.position.copyFrom(p);
          turnTo(b.node, ahead.subtract(p), 1);
          const flap = Math.sin(now * 28 + i) * 0.6;
          b.wings[0].rotation.z = flap;
          b.wings[1].rotation.z = -flap;
          if (b.t >= 1) {
            if (b.state === "out") {
              // Gone up the shaft; while the dusk lasts, another bird of the colony takes its place.
              b.state = leaving ? "nest" : "gone";
              b.wait = 3 + Math.random() * 10;
              if (b.state === "gone") b.node.setEnabled(false);
            } else {
              b.state = "nest";
              b.wait = 0;
            }
          }
          break;
        }
        case "gone":
          b.node.setEnabled(false);
          if (returning && Math.random() < dt * 0.05) {
            b.node.setEnabled(true);
            b.state = "in";
            b.t = 0;
          }
          if (!night && !returning) b.state = "nest";
          break;
      }
    }
  }
}

/** Point at fraction `k` of the way along a polyline. */
function along(route: Vector3[], k: number): Vector3 {
  const lengths = route.slice(1).map((p, i) => Vector3.Distance(route[i], p));
  let d = k * lengths.reduce((a, b) => a + b, 0);
  for (const [i, len] of lengths.entries()) {
    if (d <= len) return Vector3.Lerp(route[i], route[i + 1], len > 0 ? d / len : 0);
    d -= len;
  }
  return route[route.length - 1].clone();
}

// ---------------------------------------------------------------------------
// Ticket Beetle: flat beetles living in the ticket machines. Now and then one comes out of a slot.

class TicketBeetles implements LifeForm {
  scannables: Scannable[] = [];
  private readonly walker: TransformNode;
  private state: "inside" | "emerging" | "foraging" | "returning" = "inside";
  private timer = 6;
  private slot = 0;
  private target = Vector3.Zero();

  constructor(private readonly ctx: GameContext, private readonly world: SunkenStation) {
    const scene = ctx.scene;
    const resting = [
      { slot: 1, offset: new Vector3(-0.3, -0.25, -0.005), roll: 0.6 },
      { slot: 4, offset: new Vector3(0.05, 0.42, -0.005), roll: -1.2 },
    ];
    for (const rest of resting) {
      const node = beetle(scene);
      node.position.copyFrom(world.slots[rest.slot].add(rest.offset));
      // Flat against the machine's front, which faces -z.
      node.rotation.set(-Math.PI / 2, 0, rest.roll);
      this.scannables.push({ entryId: "ticket-beetle", meshes: node.getChildMeshes() as Mesh[], getPosition: () => node.position, isConditionMet: () => false });
    }
    this.walker = beetle(scene);
    this.walker.setEnabled(false);
    this.scannables.push({
      entryId: "ticket-beetle",
      meshes: this.walker.getChildMeshes() as Mesh[],
      getPosition: () => this.walker.position,
      isAvailable: () => this.walker.isEnabled(),
      isConditionMet: () => this.state === "emerging" || (this.state === "foraging" && this.timer > 6),
    });
  }

  update(dt: number): void {
    const w = this.walker;
    const slot = this.world.slots[this.slot];
    const floorY = STATION.hall.floor + 0.02;
    this.timer -= dt;
    switch (this.state) {
      case "inside":
        w.setEnabled(false);
        if (this.timer <= 0) {
          this.slot = Math.floor(Math.random() * this.world.slots.length);
          this.state = "emerging";
          this.timer = 2.5;
          w.setEnabled(true);
          if (flat(this.ctx.robot.position, this.world.slots[this.slot]) < 12) this.ctx.caption("A ticket slot rattles.", 2);
        }
        break;
      case "emerging": {
        // Out of the slot, sliding flat, then down the front of the machine.
        const k = 1 - this.timer / 2.5;
        w.rotation.set(-Math.PI / 2, 0, Math.PI);
        w.position.set(slot.x, slot.y - Math.max(0, k - 0.3) * (slot.y - floorY) / 0.7, slot.z - 0.02 - Math.min(0.3, k) * 0.1);
        if (this.timer <= 0) {
          this.state = "foraging";
          this.timer = 10;
          this.target = new Vector3(slot.x + (Math.random() - 0.5) * 3, floorY, slot.z - 1 - Math.random() * 2);
          w.position.set(slot.x, floorY, slot.z - 0.1);
        }
        break;
      }
      case "foraging":
      case "returning": {
        w.rotation.x = 0;
        w.rotation.z = 0;
        const to = this.target.subtract(w.position);
        to.y = 0;
        if (to.length() > 0.05) {
          w.position.addInPlace(to.normalize().scale(Math.min(to.length(), 0.35 * dt)));
          turnTo(w, to, dt * 6);
        } else if (this.state === "foraging") {
          this.target = new Vector3(slot.x + (Math.random() - 0.5) * 3, floorY, slot.z - 0.6 - Math.random() * 2.2);
        }
        if (this.state === "foraging" && this.timer <= 0) {
          this.state = "returning";
          this.target = new Vector3(slot.x, floorY, slot.z - 0.1);
        }
        // Back in: quickly up the front and through the slot.
        if (this.state === "returning" && to.length() < 0.05) {
          this.state = "inside";
          this.timer = 10 + Math.random() * 8;
        }
        // Scuttles home if the robot comes close.
        if (this.state === "foraging" && flat(this.ctx.robot.position, w.position) < 1.2) {
          this.state = "returning";
          this.target = new Vector3(slot.x, floorY, slot.z - 0.1);
        }
        break;
      }
    }
  }
}

/** Ticket Beetle photo: wide and paper-flat, a dull bronze shell, short legs and feelers. */
function beetle(scene: import("../../babylon").Scene): TransformNode {
  const node = new TransformNode("ticketBeetle", scene);
  const shell = organic(scene, "ticket-beetle-shell", "#6b5530", "shell");
  const dark = organic(scene, "ticket-beetle-legs", "#2a2219", "shell");
  const f = new Form(scene, "ticketBeetle");
  f.ellipsoid([0, 0.012, 0], [0.07, 0.016, 0.1], shell, 8);
  f.ellipsoid([0, 0.01, 0.055], [0.04, 0.012, 0.03], dark, 6);
  for (const side of [-1, 1]) {
    for (const dz of [-0.03, 0, 0.03]) f.taper([[side * 0.03, 0.006, dz], [side * 0.055, 0.002, dz + 0.01]], 0.003, 0.002, dark, 3);
    f.taper([[side * 0.012, 0.012, 0.068], [side * 0.03, 0.014, 0.1]], 0.002, 0.001, dark, 3);
  }
  for (const m of f.finish(node)) m.isPickable = true;
  return node;
}

// ---------------------------------------------------------------------------
// Pale Crayfish: in the dark pools only. They back into the silt when anything comes close or fast.

class PaleCrayfish implements LifeForm {
  scannables: Scannable[] = [];
  private readonly animals: { node: TransformNode; pool: { x: number; z: number; r: number }; target: Vector3; hidden: number; out: number }[] = [];

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    // Crayfish photo: colourless, almost see-through, no eyes.
    const body = organic(scene, "pale-crayfish", "#d8d2c4", "shell");
    body.alpha = 0.85;
    const r = rng(907);
    for (const pool of STATION.pools.filter((p) => !p.lit)) {
      for (let i = 0; i < 3; i++) {
        const node = new TransformNode("paleCrayfish", scene);
        const f = new Form(scene, "paleCrayfish");
        f.ellipsoid([0, 0.02, 0], [0.05, 0.035, 0.09], body, 6);
        f.taper([[0, 0.02, -0.04], [0, 0.018, -0.1], [0, 0.012, -0.14]], 0.022, 0.012, body, 5);
        for (const side of [-1, 1]) {
          f.taper([[side * 0.02, 0.02, 0.04], [side * 0.05, 0.02, 0.09], [side * 0.04, 0.02, 0.13]], 0.008, 0.012, body, 4);
          f.ellipsoid([side * 0.04, 0.02, 0.135], [0.022, 0.012, 0.03], body, 5);
          f.taper([[side * 0.01, 0.025, 0.05], [side * 0.06, 0.04, 0.16], [side * 0.1, 0.03, 0.24]], 0.002, 0.001, body, 3);
          for (const dz of [-0.02, 0.01, 0.035]) f.taper([[side * 0.03, 0.015, dz], [side * 0.06, 0.002, dz]], 0.004, 0.003, body, 3);
        }
        f.finish(node);
        const a = r() * Math.PI * 2, d = r() * pool.r * 0.6;
        node.position.set(pool.x + Math.cos(a) * d, FLOOR + 0.005, pool.z + Math.sin(a) * d);
        node.rotation.y = r() * 6;
        const animal = { node, pool, target: node.position.clone(), hidden: 0, out: 1 };
        this.animals.push(animal);
        this.scannables.push({
          entryId: "pale-crayfish",
          meshes: node.getChildMeshes() as Mesh[],
          getPosition: () => node.position,
          isAvailable: () => animal.out > 0.5,
          isConditionMet: () => animal.out > 0.95,
        });
      }
    }
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const fast = this.ctx.robotSpeed > 4.5;
    for (const c of this.animals) {
      const d = flat(robot, c.node.position);
      if (Math.abs(robot.y - FLOOR) < 2 && (d < 1.6 || (fast && d < 6))) c.hidden = 6;
      c.hidden = Math.max(0, c.hidden - dt);
      const want = c.hidden > 0 ? 0 : 1;
      // Backs into the silt fast, creeps out slowly.
      c.out += Math.sign(want - c.out) * Math.min(Math.abs(want - c.out), dt * (want ? 0.4 : 4));
      c.node.position.y = FLOOR + 0.005 - (1 - c.out) * 0.12;
      c.node.setEnabled(c.out > 0.02);
      if (c.out < 1) continue;
      const to = c.target.subtract(c.node.position);
      to.y = 0;
      if (to.length() < 0.03) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * c.pool.r * 0.7;
        c.target = new Vector3(c.pool.x + Math.cos(a) * r, c.node.position.y, c.pool.z + Math.sin(a) * r);
      } else {
        c.node.position.addInPlace(to.normalize().scale(Math.min(to.length(), 0.06 * dt)));
        turnTo(c.node, to, dt * 3);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tunnel Hound: sleeps in its den by day, patrols the tunnel and the platform at night,
// and charges anything it hears running or landing hard.

type HoundState = "sleep" | "patrol" | "alert" | "charge" | "search" | "home";

/** Its loop: along the tunnel, out of the east door, back along the platform and in at the west door. */
const PATROL = [
  new Vector3(477.5, FLOOR, -5.5),
  new Vector3(552.5, FLOOR, -5.5),
  new Vector3(552.5, FLOOR, -1.5),
  new Vector3(520, FLOOR, 1.5),
  new Vector3(500, FLOOR, -1.5),
  new Vector3(477.5, FLOOR, -1.5),
];
const DEN = new Vector3((STATION.den.x0 + STATION.den.x1) / 2, FLOOR, STATION.den.z0 + 1.8);

class TunnelHound implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly body: TransformNode;
  private readonly head: TransformNode;
  private readonly legs: TransformNode[] = [];
  private state: HoundState = "sleep";
  private timer = 0;
  private waypoint = 0;
  private clickTimer = 6;
  private stride = 0;
  private cooldown = 0;
  private fallTop = 0;
  private wasGrounded = true;

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    // Tunnel Hound photo: lean and long-legged, short pale-grey hide, a long eyeless head
    // and very large, thin ears.
    const hide = organic(scene, "tunnel-hound-hide", "#b3aca0", "fur");
    const pale = organic(scene, "tunnel-hound-pale", "#cfc8bb", "fur");
    const skin = organic(scene, "tunnel-hound-ear", "#b59d90", "shell");
    const dark = mat(scene, "tunnel-hound-nose", 0.12, 0.1, 0.1, 0.3);
    this.node = new TransformNode("tunnelHound", scene);
    this.body = new TransformNode("houndBody", scene);
    this.body.parent = this.node;
    const b = new Form(scene, "hound-body");
    b.ellipsoid([0, 0.78, 0.05], [0.34, 0.36, 0.95], hide);
    b.ellipsoid([0, 0.72, 0.32], [0.3, 0.34, 0.42], pale);
    // Ribs and spine showing through: a lean animal.
    for (let i = 0; i < 4; i++) b.ellipsoid([0, 0.94, 0.25 - i * 0.14], [0.08, 0.06, 0.1], hide, 5);
    b.taper([[0, 0.82, -0.42], [0, 0.72, -0.7], [0, 0.5, -0.86]], 0.05, 0.015, hide, 5);
    const parts = b.finish(this.body);
    this.head = new TransformNode("houndHead", scene);
    this.head.parent = this.body;
    this.head.position.set(0, 0.92, 0.5);
    const h = new Form(scene, "hound-head");
    h.taper([[0, -0.05, -0.08], [0, 0.03, 0.12]], 0.11, 0.1, pale, 6);
    h.ellipsoid([0, 0.06, 0.18], [0.2, 0.18, 0.24], pale);
    h.taper([[0, 0.04, 0.26], [0, 0.0, 0.44]], 0.07, 0.04, pale, 6);
    h.ellipsoid([0, 0.0, 0.45], [0.06, 0.05, 0.04], dark, 5);
    for (const side of [-1, 1]) {
      // No eyes: smooth skin where they would be. Huge upright ears, angled out.
      const ear = h.ellipsoid([side * 0.12, 0.26, 0.12], [0.03, 0.34, 0.2], skin, 7);
      ear.rotation.z = -side * 0.35;
      ear.rotation.x = -0.15;
    }
    parts.push(...h.finish(this.head));
    for (const [x, z] of [[-0.12, 0.38], [0.12, 0.38], [-0.12, -0.3], [0.12, -0.3]]) {
      const hip = new TransformNode("houndLeg", scene);
      hip.parent = this.body;
      hip.position.set(x, 0.72, z);
      const l = new Form(scene, "hound-leg");
      const back = z < 0;
      l.taper(back ? [[0, 0, 0], [0, -0.32, -0.12], [0, -0.55, 0.02], [0, -0.7, 0.04]] : [[0, 0, 0], [0, -0.36, 0.03], [0, -0.7, 0.01]], 0.06, 0.025, hide, 5);
      l.ellipsoid([0, -0.71, 0.06], [0.06, 0.03, 0.1], pale, 5);
      parts.push(...l.finish(hip));
      this.legs.push(hip);
    }
    for (const p of parts) shadows.addShadowCaster(p);
    this.node.position.copyFrom(DEN);
    this.scannables = [
      {
        entryId: "tunnel-hound",
        meshes: parts,
        getPosition: () => this.node.position.add(new Vector3(0, this.state === "sleep" ? 0.35 : 0.85, 0)),
        isConditionMet: () => this.state === "sleep",
      },
    ];
  }

  private get asleepHours(): boolean {
    const h = this.ctx.time.hours;
    return h >= 8 && h < 17;
  }

  /** Down at the hound's level: the platform, the tunnel or the track. Not on the train's roof or up the escalators. */
  private robotOnFloor(): boolean {
    const p = this.ctx.robot.position;
    return p.x > STATION.platform.x0 - 1 && p.y < FLOOR + 1.4;
  }

  /** Running or a hard landing within earshot. */
  private heardNoise(): boolean {
    const robot = this.ctx.robot;
    const p = robot.position;
    const grounded = robot.isGrounded;
    let landed = false;
    if (!grounded) this.fallTop = this.wasGrounded ? p.y : Math.max(this.fallTop, p.y);
    else if (!this.wasGrounded && this.fallTop - p.y > 1.6) landed = true;
    this.wasGrounded = grounded;
    if (!this.robotOnFloor() && !landed) return false;
    const d = Vector3.Distance(p, this.node.position);
    return d < 20 && (landed || (robot.isSprinting && this.ctx.robotSpeed > 5));
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const d = flat(robot, this.node.position);
    this.timer -= dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const noise = this.heardNoise();
    let speed = 0;
    let goal: Vector3 | undefined;
    switch (this.state) {
      case "sleep":
        if (!this.asleepHours) {
          this.state = "patrol";
          this.waypoint = 1;
        } else if (this.cooldown <= 0 && (noise || (d < 2 && this.robotOnFloor()))) {
          this.startAlert();
        }
        break;
      case "patrol":
        speed = 1.7;
        goal = PATROL[this.waypoint];
        if (flat(this.node.position, goal) < 0.4) this.waypoint = (this.waypoint + 1) % PATROL.length;
        if (this.asleepHours) this.state = "home";
        else if (this.cooldown <= 0 && (noise || (d < 3 && this.robotOnFloor()))) this.startAlert();
        if ((this.clickTimer -= dt) <= 0) {
          this.clickTimer = 8 + Math.random() * 6;
          if (Vector3.Distance(robot, this.node.position) < 25) this.ctx.caption("Low clicking from the dark.", 2.5);
        }
        break;
      case "alert":
        // Stops dead, head up, clicking at the noise.
        goal = robot;
        if (this.timer <= 0) {
          this.state = "charge";
          this.timer = 6;
        }
        break;
      case "charge":
        speed = 10;
        goal = robot;
        if (!this.robotOnFloor() || this.timer <= 0) {
          // Lost it: up on the train or out of reach.
          this.state = "search";
          this.timer = 4;
        } else if (Vector3.Distance(robot, this.node.position.add(new Vector3(0, 0.6, 0))) < 1.3) {
          this.knockDown();
        }
        break;
      case "search":
        // Circles, clicking, then gives up.
        this.node.rotation.y += dt * 1.5;
        if (this.timer <= 0) this.state = this.asleepHours ? "home" : "patrol";
        break;
      case "home":
        speed = 2.2;
        goal = DEN;
        if (flat(this.node.position, DEN) < 0.4) this.state = "sleep";
        if (!this.asleepHours) this.state = "patrol";
        break;
    }
    if (goal) this.move(goal, speed, dt);
    this.animate(dt, speed);
  }

  private startAlert(): void {
    this.state = "alert";
    this.timer = 1.4;
    this.ctx.caption("Clicking, faster. Something has heard you.", 2.5);
  }

  private knockDown(): void {
    const robot = this.ctx.robot.position;
    const away = robot.subtract(this.node.position);
    away.y = 0;
    const push = away.normalize().scale(6);
    push.y = 3;
    this.ctx.robot.push(push);
    this.ctx.status.energy = Math.max(0, this.ctx.status.energy - 30);
    this.ctx.caption("THUD! Knocked flat by something fast. Energy lost.", 3);
    this.state = this.asleepHours ? "home" : "patrol";
    this.cooldown = 10;
  }

  /** Walks towards `goal` on the platform level, using the doors between the platform and the tunnel. */
  private move(goal: Vector3, speed: number, dt: number): void {
    const p = this.node.position;
    const wall = STATION.tunnel.z1;
    const inTunnel = p.z < wall;
    const goalInTunnel = goal.z < wall;
    let to = goal;
    if (inTunnel !== goalInTunnel) {
      // Through the nearer door.
      const door = STATION.tunnelDoors.reduce((a, b) => (Math.abs((a.x0 + a.x1) / 2 - p.x) < Math.abs((b.x0 + b.x1) / 2 - p.x) ? a : b));
      const x = (door.x0 + door.x1) / 2;
      to = Math.abs(p.x - x) > 0.4 ? new Vector3(x, FLOOR, inTunnel ? wall - 0.8 : wall + 0.8) : new Vector3(x, FLOOR, inTunnel ? wall + 1 : wall - 1);
    }
    const dir = to.subtract(p);
    dir.y = 0;
    const len = dir.length();
    if (len > 0.01) {
      if (speed > 0) p.addInPlace(dir.scale(Math.min(1, (speed * dt) / len)));
      turnTo(this.node, dir, dt * (speed > 4 ? 10 : 4));
    }
    // Keep to the floor: the tunnel and den, or the platform (never onto the track or into the train).
    p.y = FLOOR;
    if (p.z < wall) {
      p.x = Math.min(STATION.tunnel.x1 - 0.5, Math.max(STATION.tunnel.x0 + 0.5, p.x));
      const inDen = p.x > STATION.den.x0 + 0.4 && p.x < STATION.den.x1 - 0.4;
      p.z = Math.min(wall - 0.4, Math.max((inDen ? STATION.den.z0 : STATION.tunnel.z0) + 0.5, p.z));
    } else {
      p.x = Math.min(STATION.platform.x1 - 0.5, Math.max(STATION.platform.x0 + 0.5, p.x));
      p.z = Math.min(STATION.track.z0 - 0.4, Math.max(wall + 0.4, p.z));
    }
  }

  private animate(dt: number, speed: number): void {
    const asleep = this.state === "sleep";
    // Asleep: lying down, curled, head on the forepaws.
    this.body.position.y += ((asleep ? -0.48 : 0) - this.body.position.y) * Math.min(1, dt * 3);
    this.head.rotation.x = asleep ? 0.35 : this.state === "alert" ? -0.25 : 0;
    this.head.rotation.y = asleep ? 0.5 : this.state === "search" || this.state === "alert" ? Math.sin(performance.now() / 160) * 0.3 : 0;
    this.stride += dt * (speed > 4 ? 14 : 6) * (speed > 0 ? 1 : 0);
    const swing = speed > 0 ? Math.sin(this.stride) * (speed > 4 ? 0.7 : 0.35) : 0;
    for (const [i, leg] of this.legs.entries()) {
      leg.rotation.x = asleep ? (i < 2 ? -1.3 : 1.3) : swing * (i % 3 === 0 ? 1 : -1);
    }
  }
}

// ---------------------------------------------------------------------------
// The departure board, the station's artifacts and the Predecessor's charging point (scan once).

export function createStationDiscoveries(ctx: GameContext, world: SunkenStation): Scannable[] {
  const near = (meshes: Mesh[], range: number) => () => flat(ctx.robot.position, meshes[0].getBoundingInfo().boundingBox.centerWorld) < range;
  return [
    { entryId: "art-departure-board", meshes: world.board, getPosition: centre(world.board[0]) },
    { entryId: "art-ticket-machine", meshes: world.ticketMachines, getPosition: () => world.slots[2] },
    { entryId: "art-station-map", meshes: world.stationMap, getPosition: centre(world.stationMap[0]) },
    { entryId: "art-umbrella-stand", meshes: world.umbrellas, getPosition: centre(world.umbrellas[0]) },
    { entryId: "art-lost-and-found", meshes: world.lostFound, getPosition: centre(world.lostFound[0]), isAvailable: near(world.lostFound, 8) },
    { entryId: "origin-charger", meshes: world.charger, getPosition: centre(world.charger[0]) },
  ];
}

// ---------------------------------------------------------------------------
// Painted cut-outs.

/** Root curtain: hundreds of hair-fine pale roots, hanging from the top edge, most stopping short. */
function rootCurtainCard(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  for (let i = 0; i < 140; i++) {
    const x = r() * s;
    const len = s * (0.35 + r() * 0.65);
    c.strokeStyle = `rgba(${200 + r() * 30},${190 + r() * 25},${160 + r() * 30},${0.7 + r() * 0.3})`;
    c.lineWidth = 0.6 + r() * 1.4;
    c.beginPath();
    c.moveTo(x, 0);
    let px = x;
    for (let y = 0; y < len; y += 8) {
      px += (r() - 0.5) * 2.5;
      c.lineTo(px, y);
    }
    c.stroke();
  }
}

/** Shaft fern frond: a bright green midrib with paired leaflets, narrowing to the tip (top of the card). */
function fernFrondCard(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  const mid = s / 2;
  c.strokeStyle = "#4f6a2c";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(mid, s);
  c.quadraticCurveTo(mid + 6, s * 0.5, mid, 4);
  c.stroke();
  for (let y = s * 0.92; y > 8; y -= 9) {
    const k = y / s;
    const len = s * 0.42 * Math.sin(Math.PI * Math.min(1, k * 1.1)) + 4;
    for (const side of [-1, 1]) {
      c.fillStyle = `rgb(${80 + r() * 25},${125 + r() * 30},${52 + r() * 15})`;
      c.beginPath();
      c.ellipse(mid + side * len / 2, y - 4, len / 2, 3.5, side * -0.25, 0, Math.PI * 2);
      c.fill();
    }
  }
}
