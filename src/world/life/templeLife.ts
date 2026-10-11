import {
  AbstractMesh,
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { card, paint, rng, surface } from "../textures";
import { GROUND, TEMPLE, type TempleHill } from "../templeHill";
import { mat } from "./materials";

/** Temple Hill species (docs/blocks/02_TEMPLE_HILL_PROPOSAL.md). */
export function createTempleLife(ctx: GameContext, shadows: ShadowGenerator): LifeForm[] {
  return [
    new TempleCedar(ctx, shadows),
    new ScrollCaps(ctx),
    new CenserPuffballs(ctx),
    new GildedCarp(ctx, shadows),
    new TitheAnts(ctx),
    new MossTanuki(ctx, shadows),
  ];
}

/** Centre of a mesh's bounds; used for meshes whose transform was baked into the vertices. */
function centre(mesh: AbstractMesh): () => Vector3 {
  return () => mesh.getBoundingInfo().boundingBox.centerWorld;
}

// ---------------------------------------------------------------------------
// Temple Cedar: the landmark tree. Resin beads glow amber at sunset.

const SUNSET_START = 17.2;
const SUNSET_END = 19.9;

class TempleCedar implements LifeForm {
  scannables: Scannable[];
  private readonly resin: StandardMaterial;

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const c = TEMPLE.cedar;
    const bark = surface(scene, "bark");
    const needles = new StandardMaterial("cedarNeedles", scene);
    needles.diffuseTexture = surface(scene, "leaves").diffuseTexture;
    needles.diffuseColor = new Color3(0.62, 0.78, 0.66);
    needles.specularColor = Color3.Black();
    const shellMat = card(scene, "foliage");
    this.resin = mat(scene, "cedarResin", 0.75, 0.45, 0.12, 0.6);

    const trunk = MeshBuilder.CreateCylinder("cedarTrunk", { diameterTop: 0.7, diameterBottom: 3.4, height: 60, tessellation: 14 }, scene);
    trunk.position.set(c.x, c.y + 30 - 0.2, c.z);
    trunk.material = bark;
    trunk.checkCollisions = true;
    const solidParts: Mesh[] = [trunk];
    // Roots that split the hall floor.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const root = MeshBuilder.CreateCylinder("cedarRoot", { diameterTop: 0.9, diameterBottom: 0.3, height: 3.2, tessellation: 6 }, scene);
      root.position.set(c.x + Math.cos(a) * 1.9, c.y + 0.35, c.z + Math.sin(a) * 1.9);
      root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      root.material = bark;
      solidParts.push(root);
    }
    for (const p of solidParts) {
      p.receiveShadows = true;
      shadows.addShadowCaster(p);
    }

    // Branches and a tall, narrow crown of needle clumps, as one merged mesh each.
    const r = rng(404);
    const branches: Mesh[] = [];
    const crowns: Mesh[] = [];
    const shells: Mesh[] = [];
    for (let y = 22; y < 68; y += 3.2) {
      const t = (y - 22) / 46;
      const reach = 9 * (1 - t) + 2.5;
      for (let k = 0; k < 3; k++) {
        const a = r() * Math.PI * 2;
        const len = reach * (0.6 + r() * 0.4);
        const b = MeshBuilder.CreateCylinder("cedarBranch", { diameterTop: 0.12, diameterBottom: 0.45 * (1 - t) + 0.15, height: len, tessellation: 5 }, scene);
        b.position.set(c.x + Math.cos(a) * len * 0.45, c.y + y, c.z + Math.sin(a) * len * 0.45);
        b.rotation.set(Math.sin(a) * 1.35, 0, -Math.cos(a) * 1.35);
        branches.push(b);
        const d = 3.5 + reach * 0.45 + r() * 2;
        const crown = MeshBuilder.CreateSphere("cedarCrown", { diameter: d, segments: 6 }, scene);
        crown.scaling.y = 0.55;
        crown.position.set(c.x + Math.cos(a) * len * 0.8, c.y + y + 0.8, c.z + Math.sin(a) * len * 0.8);
        crowns.push(crown);
        const shell = MeshBuilder.CreateSphere("cedarShell", { diameter: d * 1.2, segments: 6 }, scene);
        shell.scaling.y = 0.55;
        shell.position.copyFrom(crown.position);
        shells.push(shell);
      }
    }
    const top = MeshBuilder.CreateSphere("cedarTop", { diameter: 5, segments: 6 }, scene);
    top.scaling.y = 1.6;
    top.position.set(c.x, c.y + 68, c.z);
    crowns.push(top);
    const merge = (name: string, list: Mesh[], material: StandardMaterial, cast: boolean) => {
      const merged = Mesh.MergeMeshes(list, true, true)!;
      merged.name = name;
      merged.material = material;
      merged.isPickable = false;
      merged.receiveShadows = true;
      if (cast) shadows.addShadowCaster(merged);
      merged.freezeWorldMatrix();
      return merged;
    };
    merge("cedarBranches", branches, bark, true);
    merge("cedarCrowns", crowns, needles, true);
    // Named like the other leaf shells so the quality controller can drop them.
    merge("cedarShells", shells, shellMat, false);

    // Resin beads at robot height around the trunk.
    const beads: Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const y = 0.8 + r() * 2.6;
      const radius = 1.7 - y * 0.035;
      const bead = MeshBuilder.CreateSphere("cedarResin", { diameter: 0.14 + r() * 0.1, segments: 3 }, scene);
      bead.scaling.y = 1.4;
      bead.position.set(c.x + Math.cos(a) * radius, c.y + y, c.z + Math.sin(a) * radius);
      bead.material = this.resin;
      beads.push(bead);
    }
    const resinBeads = Mesh.MergeMeshes(beads, true)!;
    resinBeads.name = "cedarResinBeads";
    resinBeads.material = this.resin;

    const sunset = () => ctx.time.hours >= SUNSET_START && ctx.time.hours <= SUNSET_END;
    this.scannables = [
      { entryId: "temple-cedar", meshes: solidParts, getPosition: () => c.add(new Vector3(0, 2, 0)), isConditionMet: sunset },
      { entryId: "temple-cedar", meshes: [resinBeads], getPosition: () => c.add(new Vector3(0, 2, 0)), isConditionMet: sunset },
    ];
  }

  update(): void {
    const h = this.ctx.time.hours;
    // Rises into the sunset and fades as the light goes.
    const k = h < SUNSET_START || h > SUNSET_END ? 0 : Math.sin(((h - SUNSET_START) / (SUNSET_END - SUNSET_START)) * Math.PI);
    this.resin.emissiveColor.set(0.95 * k, 0.5 * k, 0.08 * k);
  }
}

/**
 * Hazy silhouette of the Temple Cedar for Shrine Street, where the real tree
 * (part of the hidden Temple Hill block) is too far away to draw. It ignores
 * fog and takes the fog's colour instead, like a shape in the haze.
 */
export function buildCedarSilhouette(scene: Scene): void {
  const c = TEMPLE.cedar;
  const material = new StandardMaterial("cedarHaze", scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  const parts: Mesh[] = [];
  const trunk = MeshBuilder.CreateCylinder("hazeTrunk", { diameterTop: 0.7, diameterBottom: 3.4, height: 60, tessellation: 8 }, scene);
  trunk.position.set(c.x, c.y + 30, c.z);
  parts.push(trunk);
  for (let y = 24; y < 68; y += 5) {
    const t = (y - 22) / 46;
    const w = 9 * (1 - t) + 4;
    const tier = MeshBuilder.CreateCylinder("hazeTier", { diameterTop: w * 0.6, diameterBottom: w * 2, height: 5.5, tessellation: 9 }, scene);
    tier.position.set(c.x + Math.sin(y) * 0.8, c.y + y, c.z + Math.cos(y) * 0.8);
    parts.push(tier);
  }
  const top = MeshBuilder.CreateCylinder("hazeTop", { diameterTop: 0, diameterBottom: 5, height: 8, tessellation: 8 }, scene);
  top.position.set(c.x, c.y + 70, c.z);
  parts.push(top);
  const haze = Mesh.MergeMeshes(parts, true)!;
  haze.name = "cedarHaze";
  haze.material = material;
  haze.applyFog = false;
  haze.isPickable = false;
  haze.freezeWorldMatrix();
  scene.onBeforeRenderObservable.add(() => {
    if (!haze.isEnabled()) return;
    // A little darker than the haze around it, never black.
    const f = scene.fogColor;
    material.emissiveColor.set(f.r * 0.78, f.g * 0.82, f.b * 0.85);
  });
}

// ---------------------------------------------------------------------------
// Scroll Caps: layered bracket fungus on old wood; thickest on the scroll shelf.

class ScrollCaps implements LifeForm {
  scannables: Scannable[] = [];

  constructor(ctx: GameContext) {
    const scene = ctx.scene;
    const capMat = mat(scene, "scrollCap", 0.86, 0.82, 0.7);
    capMat.emissiveColor = new Color3(0.06, 0.055, 0.045);
    const wallZ = TEMPLE.hall.z0 + 0.4 + 0.9;
    const fl = TEMPLE.hall.floor;
    // x, y, z, facing (radians), on the shelf?
    const spots: [number, number, number, number, boolean][] = [
      [182.6, fl + 1.9, wallZ, 0, true],
      [185.2, fl + 1.3, wallZ, 0, true],
      [187.2, fl + 1.95, wallZ, 0, true],
      [184.2, fl + 0.55, -3.8, Math.PI / 2, false],
      [186.4, fl + 0.55, -2.6, -Math.PI / 2, false],
      [195.4, fl + 0.55, 1.8, Math.PI / 2, false],
      [185.35, fl + 0.4, -5.65, 0, false],
    ];
    const r = rng(77);
    for (const [x, y, z, facing, shelf] of spots) {
      const caps: Mesh[] = [];
      for (let k = 0; k < 6; k++) {
        const cap = MeshBuilder.CreateSphere("scrollCapLayer", { diameter: 0.55 - k * 0.05 + r() * 0.1, segments: 4, slice: 0.5 }, scene);
        cap.scaling.set(1, 0.18, 0.7);
        cap.position.set((r() - 0.5) * 0.15, k * 0.09, 0.12);
        cap.rotation.y = facing;
        cap.bakeCurrentTransformIntoVertices();
        caps.push(cap);
      }
      const cluster = Mesh.MergeMeshes(caps, true)!;
      cluster.name = "scrollCap";
      cluster.position.set(x, y, z);
      cluster.rotation.y = facing;
      cluster.material = capMat;
      cluster.receiveShadows = true;
      this.scannables.push({
        entryId: "scroll-cap",
        meshes: [cluster],
        getPosition: () => cluster.position,
        isConditionMet: () => shelf,
      });
    }
  }

  update(): void {}
}

// ---------------------------------------------------------------------------
// Censer Puffball: the danger. Bursts into a sensor-clogging spore cloud.

type PuffState = "ripe" | "hiss" | "spent";

interface Puff {
  mesh: Mesh;
  state: PuffState;
  timer: number;
  /** Set when a neighbour's burst set it off: it won't calm down. */
  chained: boolean;
}

interface Cloud {
  mesh: Mesh;
  age: number;
  hit: boolean;
}

/** In the sanctum (z 10..22.6), staggered so a careful robot can weave through. */
const PUFF_SPOTS: [number, number][] = [
  [182.8, 12.4],
  [182.6, 17.2],
  [186.8, 14],
  [187, 18.8],
  [190.2, 12.6],
  [190.6, 16.2],
  [191.2, 20.2],
  [194, 13.6],
  [194.2, 18.2],
  [197, 12],
  [197.2, 16.4],
];
const CLOUD_RADIUS = 4;
const CLOUD_LIFE = 8;
const REGROW_SECONDS = 70;

class CenserPuffballs implements LifeForm {
  scannables: Scannable[] = [];
  private readonly puffs: Puff[] = [];
  private readonly clouds: Cloud[] = [];
  private hissCaption = 0;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const skin = mat(scene, "puffballSkin", 0.62, 0.5, 0.3);
    skin.emissiveColor = new Color3(0.06, 0.04, 0.01);
    const sporeMat = new StandardMaterial("sporeCloud", scene);
    sporeMat.diffuseColor = new Color3(0.8, 0.62, 0.28);
    sporeMat.emissiveColor = new Color3(0.42, 0.32, 0.12);
    sporeMat.specularColor = Color3.Black();
    sporeMat.alpha = 0.5;
    sporeMat.backFaceCulling = false;
    const r = rng(1201);
    PUFF_SPOTS.forEach(([x, z], i) => {
      const parts: Mesh[] = [];
      // Each spot is a little cluster: one big ball and a couple of small ones.
      for (let k = 0; k < 3; k++) {
        const d = k === 0 ? 0.9 : 0.35 + r() * 0.2;
        const ball = MeshBuilder.CreateSphere("puffball", { diameter: d, segments: k === 0 ? 7 : 4 }, scene);
        ball.scaling.y = 0.85;
        ball.position.set(k === 0 ? 0 : (r() - 0.5) * 1.1, d * 0.38, k === 0 ? 0 : (r() - 0.5) * 1.1);
        ball.bakeCurrentTransformIntoVertices();
        parts.push(ball);
      }
      const mesh = Mesh.MergeMeshes(parts, true)!;
      mesh.name = `puffball${i}`;
      mesh.position.set(x, TEMPLE.hall.floor, z);
      mesh.material = skin;
      mesh.receiveShadows = true;
      const puff: Puff = { mesh, state: "ripe", timer: 0, chained: false };
      this.puffs.push(puff);
      this.scannables.push({
        entryId: "censer-puffball",
        meshes: [mesh],
        getPosition: () => mesh.position.add(new Vector3(0, 0.4, 0)),
        // Watching a cloud from outside it.
        isConditionMet: () => this.clouds.some((c) => c.age < CLOUD_LIFE) && !this.inCloud(),
      });
    });
    for (let i = 0; i < 5; i++) {
      const cloud = MeshBuilder.CreateSphere(`sporeCloud${i}`, { diameter: 2, segments: 8 }, scene);
      cloud.material = sporeMat;
      cloud.isPickable = false;
      cloud.setEnabled(false);
      this.clouds.push({ mesh: cloud, age: CLOUD_LIFE, hit: true });
    }
    ctx.wind.onGust((gusting) => {
      if (!gusting) return;
      // The draught through the hall sets off a ripe puffball or two.
      const ripe = this.puffs.filter((p) => p.state === "ripe" && this.robotDistance(p) > 7);
      for (let i = 0; i < Math.min(2, ripe.length); i++) this.burst(ripe[Math.floor(Math.random() * ripe.length)], false);
      if (ripe.length > 0 && Vector3.Distance(ctx.robot.position, new Vector3(190, 11, 16)) < 35) {
        ctx.caption("A soft pop from the dark half of the hall", 3);
      }
    });
  }

  private robotDistance(p: Puff): number {
    const robot = this.ctx.robot.position;
    if (robot.y > TEMPLE.hall.floor + 2.5) return Infinity;
    return Math.hypot(robot.x - p.mesh.position.x, robot.z - p.mesh.position.z);
  }

  private inCloud(): boolean {
    const robot = this.ctx.robot.position;
    return this.clouds.some((c) => c.age < CLOUD_LIFE - 2 && Vector3.Distance(robot, c.mesh.position) < c.mesh.scaling.x);
  }

  update(dt: number): void {
    const speed = this.ctx.robotSpeed;
    const trigger = this.ctx.robot.isSprinting ? 6 : speed > 0.3 ? 2.2 : 1.1;
    this.hissCaption -= dt;
    const t = performance.now() / 1000;

    for (const p of this.puffs) {
      const d = this.robotDistance(p);
      p.timer -= dt;
      switch (p.state) {
        case "ripe":
          p.mesh.scaling.setAll(1 + Math.sin(t * 0.8 + p.mesh.position.x) * 0.02);
          if (d < trigger) this.hiss(p, 1.6, false);
          break;
        case "hiss": {
          const swell = 1.08 + Math.sin(t * 30) * 0.05;
          p.mesh.scaling.set(swell, swell * 1.1, swell);
          if (!p.chained && d > 3.4) {
            p.state = "ripe";
          } else if (p.timer <= 0) {
            this.burst(p, true);
          }
          break;
        }
        case "spent": {
          // Deflated, then slowly swelling back.
          const grow = Math.min(1, Math.max(0, 1 - p.timer / REGROW_SECONDS));
          p.mesh.scaling.set(0.35 + 0.65 * grow, (0.25 + 0.75 * grow) * 1, 0.35 + 0.65 * grow);
          if (p.timer <= 0) p.state = "ripe";
          break;
        }
      }
    }

    for (const c of this.clouds) {
      if (c.age >= CLOUD_LIFE) continue;
      c.age += dt;
      const grow = Math.min(1, c.age / 1.2);
      const radius = CLOUD_RADIUS * (0.3 + 0.7 * grow);
      c.mesh.scaling.setAll(radius);
      c.mesh.position.y += dt * 0.25;
      c.mesh.visibility = Math.max(0, Math.min(1, (CLOUD_LIFE - c.age) / 3)) * 0.9;
      if (!c.hit && c.age < CLOUD_LIFE - 2 && Vector3.Distance(this.ctx.robot.position.add(new Vector3(0, 0.7, 0)), c.mesh.position) < radius) {
        c.hit = true;
        this.ctx.sporeHit();
      }
      if (c.age >= CLOUD_LIFE) c.mesh.setEnabled(false);
    }
  }

  private hiss(p: Puff, seconds: number, chained: boolean): void {
    p.state = "hiss";
    p.timer = seconds;
    p.chained = chained;
    if (!chained && this.hissCaption <= 0) {
      this.hissCaption = 4;
      this.ctx.caption("A sharp hiss, close by. Something is swelling.", 2.5);
    }
  }

  private burst(p: Puff, chain: boolean): void {
    if (p.state === "spent") return;
    p.state = "spent";
    p.timer = REGROW_SECONDS;
    const cloud = this.clouds.find((c) => c.age >= CLOUD_LIFE) ?? this.clouds[0];
    cloud.age = 0;
    cloud.hit = false;
    cloud.mesh.position.set(p.mesh.position.x, p.mesh.position.y + 0.8, p.mesh.position.z);
    cloud.mesh.scaling.setAll(0.5);
    cloud.mesh.setEnabled(true);
    if (!chain) return;
    // Spores set off the ripe neighbours.
    for (const other of this.puffs) {
      if (other.state !== "ripe") continue;
      const d = Vector3.Distance(other.mesh.position, p.mesh.position);
      if (d < 4.6) this.hiss(other, 0.35 + d * 0.08, true);
    }
  }
}

// ---------------------------------------------------------------------------
// Gilded Carp: surfaces by the bridge when everything stays still.

type CarpState = "hidden" | "rising" | "feeding" | "sinking";

class GildedCarp implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly parts: Mesh[] = [];
  private readonly tail: Mesh;
  private state: CarpState = "hidden";
  private still = 0;
  private timer = 0;
  private static readonly SPOT = new Vector3(145.2, TEMPLE.pond.water, -12.5);

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const gold = mat(scene, "carpGold", 0.85, 0.6, 0.2, 0.7);
    gold.specularPower = 40;
    gold.emissiveColor = new Color3(0.08, 0.05, 0.01);
    const fin = mat(scene, "carpFin", 0.9, 0.55, 0.3);
    fin.alpha = 0.85;
    fin.backFaceCulling = false;
    this.node = new TransformNode("gildedCarp", scene);
    const body = MeshBuilder.CreateSphere("carpBody", { diameter: 1, segments: 10 }, scene);
    body.scaling.set(0.42, 0.34, 1.3);
    body.material = gold;
    const head = MeshBuilder.CreateSphere("carpHead", { diameter: 0.42, segments: 8 }, scene);
    head.scaling.z = 1.3;
    head.position.set(0, 0.02, 0.62);
    head.material = gold;
    for (let i = 0; i < 4; i++) {
      const plate = MeshBuilder.CreateBox(`carpPlate${i}`, { width: 0.36, height: 0.05, depth: 0.26 }, scene);
      plate.position.set(0, 0.16 - Math.abs(i - 1.5) * 0.02, -0.35 + i * 0.22);
      plate.rotation.x = -0.12;
      plate.material = gold;
      this.parts.push(plate);
    }
    this.tail = MeshBuilder.CreatePlane("carpTail", { width: 0.55, height: 0.5 }, scene);
    this.tail.rotation.y = Math.PI / 2;
    this.tail.position.set(0, 0, -0.85);
    this.tail.material = fin;
    const dorsal = MeshBuilder.CreatePlane("carpDorsal", { width: 0.5, height: 0.22 }, scene);
    dorsal.rotation.y = Math.PI / 2;
    dorsal.position.set(0, 0.22, -0.1);
    dorsal.material = fin;
    this.parts.push(body, head, this.tail, dorsal);
    for (const p of this.parts) {
      p.parent = this.node;
      shadows.addShadowCaster(p);
    }
    this.node.position.copyFrom(GildedCarp.SPOT).addInPlaceFromFloats(0, -0.4, 0);
    this.setVisible(false);

    // Cedar seeds drifting on the water where it feeds.
    const seedMat = mat(scene, "cedarSeed", 0.45, 0.3, 0.16);
    const r = rng(12);
    const seeds: Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const s = MeshBuilder.CreateDisc("cedarSeed", { radius: 0.05 + r() * 0.03, tessellation: 6 }, scene);
      s.rotation.x = Math.PI / 2;
      s.position.set(GildedCarp.SPOT.x + (r() - 0.5) * 2.4, TEMPLE.pond.water + 0.012, GildedCarp.SPOT.z + (r() - 0.5) * 2.4);
      s.bakeCurrentTransformIntoVertices();
      seeds.push(s);
    }
    const seedMesh = Mesh.MergeMeshes(seeds, true)!;
    seedMesh.material = seedMat;
    seedMesh.isPickable = false;

    this.scannables = [
      {
        entryId: "gilded-carp",
        meshes: this.parts,
        getPosition: () => this.node.position.add(new Vector3(0, 0.15, 0)),
        isAvailable: () => this.state !== "hidden",
        isConditionMet: () => this.state === "feeding",
      },
    ];
  }

  private onBridge(): boolean {
    const p = this.ctx.robot.position;
    const b = TEMPLE.bridge;
    return Math.abs(p.x - b.x) < 1.6 && p.z < b.z0 && p.z > b.z1 && p.y > GROUND - 0.2;
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const calm = this.ctx.robotSpeed < 0.3 && this.onBridge();
    this.still = calm ? this.still + dt : 0;
    const startled = this.ctx.robotSpeed > 2.5 && Vector3.Distance(robot, this.node.position) < 9;
    this.timer -= dt;
    const t = performance.now() / 1000;
    this.tail.rotation.x = Math.sin(t * 5) * 0.4;

    switch (this.state) {
      case "hidden":
        if (this.still > 4) {
          this.state = "rising";
          this.timer = 2;
          this.setVisible(true);
          this.ctx.caption("Ripples spread out under the bridge", 3);
        }
        break;
      case "rising":
        this.node.position.y += (TEMPLE.pond.water - 0.12 - this.node.position.y) * Math.min(1, dt * 2);
        if (startled) this.sink();
        else if (this.timer <= 0) {
          this.state = "feeding";
          this.timer = 14;
        }
        break;
      case "feeding": {
        // Slow circles through the floating seeds, gulping at the surface.
        const a = t * 0.5;
        const target = GildedCarp.SPOT.add(new Vector3(Math.cos(a) * 0.9, -0.1 + Math.max(0, Math.sin(t * 2.2)) * 0.07, Math.sin(a) * 0.9));
        this.node.position = Vector3.Lerp(this.node.position, target, Math.min(1, dt * 2));
        this.node.rotation.y = a + Math.PI;
        if (startled || this.timer <= 0) this.sink();
        break;
      }
      case "sinking":
        this.node.position.y -= dt * 0.8;
        if (this.timer <= 0) {
          this.state = "hidden";
          this.still = 0;
          this.setVisible(false);
        }
        break;
    }
  }

  private sink(): void {
    this.state = "sinking";
    this.timer = 1;
  }

  private setVisible(v: boolean): void {
    for (const m of this.parts) m.isVisible = v;
  }
}

// ---------------------------------------------------------------------------
// Tithe Ants: a column between the fallen persimmons and the mound under the racks.

const TRAIL: Vector3[] = [
  TEMPLE.fruitPile.add(new Vector3(0, 0, 0.6)),
  new Vector3(168.5, GROUND, -18),
  new Vector3(166.8, GROUND, -14),
  new Vector3(164.5, GROUND, -11.5),
  new Vector3(162.5, GROUND, -9.2),
  TEMPLE.antMound.add(new Vector3(0.6, 0, -0.9)),
];
const ANTS = 56;

class TitheAnts implements LifeForm {
  scannables: Scannable[];
  private readonly ants: Mesh;
  private readonly loads: Mesh;
  private readonly lengths: number[] = [];
  private readonly total: number;
  private readonly phase: number[] = [];
  private readonly antBuffer = new Float32Array(ANTS * 16);
  private readonly loadBuffer = new Float32Array((ANTS / 2) * 16);
  private active = true;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const shell = mat(scene, "antShell", 0.3, 0.1, 0.06, 0.4);
    const fruit = mat(scene, "persimmon", 0.9, 0.42, 0.1);
    // One ant: head, thorax and abdomen in a row (boxes: there are a lot of ants).
    const parts: Mesh[] = [];
    for (const [z, d] of [[0.065, 0.032], [0, 0.026], [-0.07, 0.045]] as const) {
      const s = MeshBuilder.CreateBox("antPart", { width: d, height: d * 0.8, depth: d * 1.4 }, scene);
      s.position.set(0, 0.025, z);
      s.bakeCurrentTransformIntoVertices();
      parts.push(s);
    }
    const legs = MeshBuilder.CreateBox("antLegs", { width: 0.09, height: 0.006, depth: 0.05 }, scene);
    legs.position.y = 0.012;
    legs.bakeCurrentTransformIntoVertices();
    parts.push(legs);
    this.ants = Mesh.MergeMeshes(parts, true)!;
    this.ants.name = "titheAnts";
    this.ants.material = shell;
    this.ants.thinInstanceSetBuffer("matrix", this.antBuffer, 16, false);
    this.ants.thinInstanceEnablePicking = true;
    this.ants.alwaysSelectAsActiveMesh = true;
    this.loads = MeshBuilder.CreateBox("antLoad", { width: 0.04, height: 0.035, depth: 0.04 }, scene);
    this.loads.material = fruit;
    this.loads.isPickable = false;
    this.loads.thinInstanceSetBuffer("matrix", this.loadBuffer, 16, false);
    this.loads.alwaysSelectAsActiveMesh = true;

    for (let i = 0; i + 1 < TRAIL.length; i++) this.lengths.push(Vector3.Distance(TRAIL[i], TRAIL[i + 1]));
    this.total = this.lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ANTS; i++) this.phase.push(i / ANTS + Math.random() * 0.01);

    // The mound, with ants swarming over it.
    const mound = MeshBuilder.CreateSphere("antMound", { diameter: 1.6, segments: 8, slice: 0.5 }, scene);
    mound.scaling.y = 0.55;
    mound.position.copyFrom(TEMPLE.antMound);
    mound.material = surface(scene, "dirt");
    mound.receiveShadows = true;
    const swarm: Mesh[] = [];
    const r = rng(8);
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 0.7;
      const s = MeshBuilder.CreateBox("moundAnt", { width: 0.03, height: 0.025, depth: 0.09 }, scene);
      s.position.set(Math.cos(a) * d, Math.sqrt(Math.max(0, 0.64 - d * d)) * 0.55 + 0.01, Math.sin(a) * d);
      s.rotation.y = r() * 3;
      s.bakeCurrentTransformIntoVertices();
      swarm.push(s);
    }
    const swarmMesh = Mesh.MergeMeshes(swarm, true)!;
    swarmMesh.parent = mound;
    swarmMesh.material = shell;

    const nearMound = () => Vector3.Distance(ctx.robot.position, TEMPLE.antMound) < 4;
    this.scannables = [
      {
        entryId: "tithe-ant",
        meshes: [this.ants],
        getPosition: () => this.nearestOnTrail(ctx.robot.position),
        isAvailable: () => this.active,
        isConditionMet: nearMound,
      },
      { entryId: "tithe-ant", meshes: [mound, swarmMesh], getPosition: () => TEMPLE.antMound.add(new Vector3(0, 0.3, 0)), isConditionMet: () => true },
    ];
  }

  private pointAt(u: number): { p: Vector3; dir: Vector3 } {
    let d = (((u % 1) + 1) % 1) * this.total;
    for (let i = 0; i < this.lengths.length; i++) {
      if (d <= this.lengths[i]) {
        const a = TRAIL[i];
        const b = TRAIL[i + 1];
        return { p: Vector3.Lerp(a, b, d / this.lengths[i]), dir: b.subtract(a).normalize() };
      }
      d -= this.lengths[i];
    }
    const n = TRAIL.length;
    return { p: TRAIL[n - 1].clone(), dir: TRAIL[n - 1].subtract(TRAIL[n - 2]).normalize() };
  }

  private nearestOnTrail(q: Vector3): Vector3 {
    let best = TRAIL[0];
    let bestD = Infinity;
    for (let i = 0; i + 1 < TRAIL.length; i++) {
      const a = TRAIL[i];
      const ab = TRAIL[i + 1].subtract(a);
      const t = Math.max(0, Math.min(1, Vector3.Dot(q.subtract(a), ab) / ab.lengthSquared()));
      const p = a.add(ab.scale(t));
      const d = Vector3.DistanceSquared(p, q);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best.add(new Vector3(0, 0.05, 0));
  }

  update(dt: number): void {
    // By night the whole colony stays inside the mound.
    this.active = !this.ctx.time.isNight;
    this.ants.isVisible = this.active;
    this.loads.isVisible = this.active;
    if (!this.active || !this.ants.isEnabled()) return;
    const step = (0.22 * dt) / this.total;
    const m = new Matrix();
    const q = new Quaternion();
    let load = 0;
    for (let i = 0; i < ANTS; i++) {
      this.phase[i] = (this.phase[i] + step) % 1;
      // Half the column walks out to the fruit, half walks home carrying a piece.
      const home = i % 2 === 0;
      const u = home ? this.phase[i] : 1 - this.phase[i];
      const { p, dir } = this.pointAt(u);
      const side = home ? 0.06 : -0.06;
      const heading = Math.atan2(dir.x, dir.z) + (home ? 0 : Math.PI);
      const wobble = Math.sin(this.phase[i] * 400 + i) * 0.03;
      Quaternion.FromEulerAnglesToRef(0, heading + wobble * 4, 0, q);
      const pos = new Vector3(p.x + dir.z * side + wobble, p.y + 0.005, p.z - dir.x * side);
      Matrix.ComposeToRef(new Vector3(1.6, 1.6, 1.6), q, pos, m);
      m.copyToArray(this.antBuffer, i * 16);
      if (home) {
        const carry = pos.add(new Vector3(Math.sin(heading) * 0.12, 0.05, Math.cos(heading) * 0.12));
        Matrix.ComposeToRef(Vector3.One(), q, carry, m);
        m.copyToArray(this.loadBuffer, load++ * 16);
      }
    }
    this.ants.thinInstanceBufferUpdated("matrix");
    this.loads.thinInstanceBufferUpdated("matrix");
  }
}

// ---------------------------------------------------------------------------
// Moss Tanuki: sleeps on the gate by day, follows the robot and raids the offering box at night.

type TanukiState = "sleep" | "descend" | "forage" | "raid" | "ascend";

class MossTanuki implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly body: TransformNode;
  private state: TanukiState = "sleep";
  private timer = 0;
  private hop?: { from: Vector3; to: Vector3; t: number; duration: number };
  private target = Vector3.Zero();
  private static readonly LANDING = new Vector3(124.5, GROUND, 2.5);
  private static readonly RAID = TEMPLE.offeringBox.add(new Vector3(-0.85, -1, 0));

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const fur = mat(scene, "tanukiFur", 0.42, 0.34, 0.26);
    const mask = mat(scene, "tanukiMask", 0.1, 0.09, 0.08);
    const moss = mat(scene, "tanukiMoss", 0.3, 0.48, 0.18);
    const pale = mat(scene, "tanukiPale", 0.78, 0.72, 0.6);
    this.node = new TransformNode("mossTanuki", scene);
    this.body = new TransformNode("mossTanukiBody", scene);
    this.body.parent = this.node;
    const parts: Mesh[] = [];
    const add = (mesh: Mesh, material: StandardMaterial) => {
      mesh.material = material;
      mesh.parent = this.body;
      shadows.addShadowCaster(mesh);
      parts.push(mesh);
      return mesh;
    };
    const torso = add(MeshBuilder.CreateSphere("tanukiTorso", { diameter: 1, segments: 10 }, scene), fur);
    torso.scaling.set(0.62, 0.52, 0.85);
    torso.position.y = 0.38;
    const back = add(MeshBuilder.CreateSphere("tanukiMossBack", { diameter: 1, segments: 8, slice: 0.5 }, scene), moss);
    back.scaling.set(0.66, 0.5, 0.86);
    back.position.y = 0.44;
    const head = add(MeshBuilder.CreateSphere("tanukiHead", { diameter: 0.42, segments: 8 }, scene), pale);
    head.position.set(0, 0.52, 0.48);
    const band = add(MeshBuilder.CreateSphere("tanukiMaskBand", { diameter: 0.43, segments: 8, slice: 0.5 }, scene), mask);
    band.scaling.set(1.02, 0.35, 1.02);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.54, 0.5);
    const snout = add(MeshBuilder.CreateSphere("tanukiSnout", { diameter: 0.16, segments: 6 }, scene), mask);
    snout.position.set(0, 0.47, 0.7);
    for (const side of [-1, 1]) {
      const ear = add(MeshBuilder.CreateCylinder(`tanukiEar${side}`, { diameterTop: 0, diameterBottom: 0.13, height: 0.13, tessellation: 5 }, scene), mask);
      ear.position.set(side * 0.13, 0.73, 0.44);
      for (const z of [-0.25, 0.25]) {
        const leg = add(MeshBuilder.CreateCylinder(`tanukiLeg${side}${z}`, { diameter: 0.1, height: 0.22, tessellation: 5 }, scene), mask);
        leg.position.set(side * 0.2, 0.1, z);
      }
    }
    const tail = add(MeshBuilder.CreateSphere("tanukiTail", { diameter: 0.3, segments: 6 }, scene), fur);
    tail.scaling.z = 1.8;
    tail.position.set(0, 0.32, -0.55);
    tail.rotation.x = -0.4;

    this.node.position.copyFrom(TEMPLE.gateRoof);
    this.node.rotation.y = Math.PI / 2;
    this.scannables = [
      {
        entryId: "moss-tanuki",
        meshes: parts,
        getPosition: () => this.node.position.add(new Vector3(0, 0.4, 0)),
        isConditionMet: () => this.state === "raid",
      },
    ];
  }

  update(dt: number): void {
    const night = this.ctx.time.isNight;
    const robot = this.ctx.robot.position;
    const t = performance.now() / 1000;
    this.timer -= dt;

    switch (this.state) {
      case "sleep":
        // Curled up, breathing.
        this.body.scaling.set(1, 0.82 + Math.sin(t * 1.3) * 0.03, 0.9);
        if (night) this.startHop(MossTanuki.LANDING, 1.6, "descend");
        break;
      case "descend":
      case "ascend":
        this.updateHop(dt);
        break;
      case "forage": {
        this.body.scaling.setAll(1);
        if (!night) {
          if (this.walk(MossTanuki.LANDING, 2.4, dt)) this.startHop(TEMPLE.gateRoof, 1.8, "ascend");
          break;
        }
        if (this.timer <= 0) {
          // Off to the offering box.
          if (this.walk(MossTanuki.RAID, 2.2, dt)) {
            this.state = "raid";
            this.timer = 9;
            if (Vector3.Distance(robot, this.node.position) < 30) this.ctx.caption("Scratching and rattling at the offering box", 3);
          }
          break;
        }
        // Curious: keeps about six metres from the robot while it is nearby.
        const toRobot = robot.subtract(this.node.position);
        toRobot.y = 0;
        const d = toRobot.length();
        if (d < 22 && robot.y < GROUND + 3 && robot.x > 121) {
          const want = this.node.position.add(toRobot.normalize().scale(d - 6));
          if (Math.abs(d - 6) > 1.2) this.walk(want, d < 3 ? 4 : 1.8, dt);
          else this.face(robot, dt);
        } else if (this.walk(this.target, 1.2, dt)) {
          this.target = new Vector3(126 + Math.random() * 45, GROUND, -4 + Math.random() * 22);
        }
        break;
      }
      case "raid":
        this.face(TEMPLE.offeringBox, dt);
        // Up on its hind legs, rummaging.
        this.body.rotation.x = -0.5 + Math.sin(t * 9) * 0.08;
        this.body.position.y = 0.15;
        if (this.timer <= 0 || !night) {
          this.body.rotation.x = 0;
          this.body.position.y = 0;
          this.state = "forage";
          this.timer = 40 + Math.random() * 30;
        }
        break;
    }
  }

  private startHop(to: Vector3, duration: number, state: TanukiState): void {
    this.hop = { from: this.node.position.clone(), to: to.clone(), t: 0, duration };
    this.state = state;
  }

  private updateHop(dt: number): void {
    const h = this.hop!;
    h.t = Math.min(1, h.t + dt / h.duration);
    const p = Vector3.Lerp(h.from, h.to, h.t);
    p.y += Math.sin(h.t * Math.PI) * 2.5;
    this.node.position.copyFrom(p);
    const dir = h.to.subtract(h.from);
    this.node.rotation.y = Math.atan2(dir.x, dir.z);
    if (h.t < 1) return;
    if (this.state === "descend") {
      this.state = "forage";
      this.timer = 25 + Math.random() * 20;
      this.target = this.node.position.clone();
    } else {
      this.state = "sleep";
      this.node.rotation.y = Math.PI / 2;
    }
  }

  /** @returns true once arrived */
  private walk(target: Vector3, speed: number, dt: number): boolean {
    const to = target.subtract(this.node.position);
    to.y = 0;
    const len = to.length();
    if (len < 0.15) return true;
    this.node.position.addInPlace(to.scale(Math.min(1, (speed * dt) / len)));
    this.node.position.y = GROUND + Math.abs(Math.sin(performance.now() / 110)) * 0.04;
    this.node.rotation.y = Math.atan2(to.x, to.z);
    return false;
  }

  private face(target: Vector3, dt: number): void {
    const to = target.subtract(this.node.position);
    const yaw = Math.atan2(to.x, to.z);
    let d = yaw - this.node.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.node.rotation.y += d * Math.min(1, dt * 4);
  }
}

// ---------------------------------------------------------------------------
// Human artifacts, the Wish Wall and the Predecessor's mark (static, scan once).

export function createTempleDiscoveries(ctx: GameContext, world: TempleHill): Scannable[] {
  const scene = ctx.scene;
  // The mark: a bronze plate at the foot of the spire, scratched by the Predecessor Unit.
  const plate = MeshBuilder.CreatePlane("predecessorMark", { width: 0.9, height: 0.7 }, scene);
  plate.position.copyFrom(world.pagodaTop).addInPlaceFromFloats(0, 0.42, -0.42);
  plate.rotation.x = -0.25;
  const markMat = new StandardMaterial("predecessorMark", scene);
  markMat.diffuseTexture = paint(scene, "tex:predecessorMark", 256, drawMark);
  markMat.specularColor = new Color3(0.3, 0.3, 0.3);
  markMat.backFaceCulling = false;
  plate.material = markMat;
  const stand = MeshBuilder.CreateBox("predecessorMarkStand", { width: 1, height: 0.8, depth: 0.12 }, scene);
  stand.position.copyFrom(world.pagodaTop).addInPlaceFromFloats(0, 0.4, -0.36);
  stand.rotation.x = -0.25;
  stand.material = scene.getMaterialByName("templeBronze");

  const wish = world.wishWall;
  return [
    ...world.lanterns.map((l) => ({ entryId: "art-stone-lantern", meshes: [l], getPosition: centre(l) })),
    { entryId: "art-temple-bell", meshes: [world.bell], getPosition: centre(world.bell) },
    { entryId: "art-offering-box", meshes: [world.offeringBox], getPosition: () => world.offeringBox.position },
    { entryId: "art-scroll-shelf", meshes: [world.scrollShelf], getPosition: () => world.scrollShelf.position },
    {
      entryId: "art-wish-wall",
      meshes: [wish],
      getPosition: () => wish.position,
      // The plaques are too small to make out from across the hall.
      isAvailable: () => Vector3.Distance(ctx.robot.position, wish.position) < 11,
    },
    { entryId: "origin-mark", meshes: [plate, stand], getPosition: () => plate.position },
  ];
}

/** Bronze plate with the survey mark scratched into it. */
function drawMark(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  c.fillStyle = "#4f6b5c";
  c.fillRect(0, 0, s, s);
  for (let i = 0; i < 400; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "30,45,38" : "120,150,120"}, ${0.1 + r() * 0.2})`;
    c.fillRect(r() * s, r() * s, 2 + r() * 6, 2 + r() * 6);
  }
  c.strokeStyle = "rgba(225, 215, 190, 0.9)";
  c.lineCap = "round";
  c.lineWidth = 5;
  const line = (pts: [number, number][]) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x * s, y * s) : c.lineTo(x * s + (r() - 0.5) * 3, y * s + (r() - 0.5) * 3)));
    c.stroke();
  };
  // A ring (the survey sign) with an arrow leaving it.
  c.beginPath();
  c.arc(s * 0.38, s * 0.5, s * 0.17, 0, Math.PI * 2);
  c.stroke();
  line([[0.38, 0.33], [0.38, 0.67]]);
  line([[0.55, 0.5], [0.86, 0.5]]);
  line([[0.76, 0.4], [0.87, 0.5], [0.76, 0.6]]);
  c.lineWidth = 2;
  for (let i = 0; i < 5; i++) line([[0.15 + i * 0.07, 0.82], [0.18 + i * 0.07, 0.9]]);
}
