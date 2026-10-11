import {
  Color3,
  Mesh,
  MeshBuilder,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { mat } from "./materials";

/** The five MVP plant species. Positions match the Shrine Street greybox. */
export function createPlants(ctx: GameContext, shadows: ShadowGenerator): LifeForm[] {
  return [
    new LanternWisteria(ctx, shadows),
    new RebarIvy(ctx),
    new ShutterFerns(ctx),
    new SunLotus(ctx),
    new ChoirMoss(ctx),
  ];
}

/** Hangs under the overpass deck; pods glow at night. */
class LanternWisteria implements LifeForm {
  scannables: Scannable[];
  private readonly podMat: StandardMaterial;
  static readonly CENTER = new Vector3(-4.5, 3.8, 0.75);

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const strandMat = mat(scene, "wisteria", 0.65, 0.55, 0.85);
    this.podMat = mat(scene, "wisteriaPod", 0.85, 0.82, 0.7);
    const meshes: Mesh[] = [];
    for (let z = -3; z <= 4.5; z += 0.9) {
      const h = 1.6 + Math.abs(Math.sin(z * 3.7)) * 1.2;
      const strand = MeshBuilder.CreateBox(`wisteria${z}`, { width: 2.4, height: h, depth: 0.25 }, scene);
      strand.position.set(-4.5, 5.6 - h / 2, z);
      strand.material = strandMat;
      shadows.addShadowCaster(strand);
      meshes.push(strand);
      for (const dx of [-0.7, 0.5]) {
        const pod = MeshBuilder.CreateSphere(`wisteriaPod${z}${dx}`, { diameter: 0.28, segments: 6 }, scene);
        pod.scaling.y = 1.4;
        pod.position.set(-4.5 + dx, 5.6 - h - 0.1, z);
        pod.material = this.podMat;
        meshes.push(pod);
      }
    }
    this.scannables = [
      {
        entryId: "lantern-wisteria",
        meshes,
        getPosition: () => LanternWisteria.CENTER,
        isConditionMet: () => this.ctx.time.isNight,
      },
    ];
  }

  update(): void {
    const glow = 1 - this.ctx.time.daylight;
    this.podMat.emissiveColor.set(0.25 * glow, 0.95 * glow, 0.75 * glow);
  }
}

/** Rust-red ivy on the façades, plus one wall it has split open. */
class RebarIvy implements LifeForm {
  scannables: Scannable[];

  constructor(ctx: GameContext) {
    const scene = ctx.scene;
    const ivyMat = mat(scene, "ivy", 0.45, 0.2, 0.12);
    ivyMat.backFaceCulling = false;
    const patches: [number, number, number, number, number][] = [
      // x0, x1, wall z, y0, y1
      [-50, -42, 4.95, 0, 9],
      [-30, -18, 4.95, 0, 6],
      [26, 36, 4.95, 2, 8],
      [-40, -36, -4.95, 0, 7],
      [-10, -5, -4.95, 0, 10],
      [24, 30, -4.95, 1, 12],
    ];
    const planes = patches.map(([x0, x1, z, y0, y1]) => {
      const p = MeshBuilder.CreatePlane(`ivy${x0}${z}`, { width: x1 - x0, height: y1 - y0 }, scene);
      p.position.set((x0 + x1) / 2, (y0 + y1) / 2, z + (z > 0 ? -0.02 : 0.02));
      if (z < 0) p.rotation.y = Math.PI;
      p.material = ivyMat;
      return p;
    });

    // The split wall: a crack in the southC façade with thick stems growing into it.
    const crackMat = mat(scene, "crack", 0.08, 0.07, 0.07);
    const stemMat = mat(scene, "ivyStem", 0.36, 0.17, 0.1);
    const crack = MeshBuilder.CreateBox("ivyCrack", { width: 0.5, height: 4, depth: 0.1 }, scene);
    crack.position.set(-2.3, 2, -4.95);
    crack.rotation.z = 0.12;
    crack.material = crackMat;
    const split: Mesh[] = [crack];
    for (let i = 0; i < 4; i++) {
      const stem = MeshBuilder.CreateCylinder(`ivySplitStem${i}`, { diameter: 0.12, height: 2.2 }, scene);
      stem.position.set(-3.2 + i * 0.6, 1.2 + i * 0.5, -4.85);
      stem.rotation.z = (i % 2 ? -1 : 1) * 0.7;
      stem.material = stemMat;
      split.push(stem);
    }
    const leaves = MeshBuilder.CreatePlane("ivySplitLeaves", { width: 3, height: 2.5 }, scene);
    leaves.position.set(-2.3, 1.6, -4.9);
    leaves.rotation.y = Math.PI;
    leaves.material = ivyMat;
    split.push(leaves);

    this.scannables = [
      ...planes.map((p) => ({ entryId: "rebar-ivy", meshes: [p], getPosition: () => p.position })),
      { entryId: "rebar-ivy", meshes: split, getPosition: () => crack.position, isConditionMet: () => true },
    ];
  }

  update(): void {}
}

/** Fern clusters that snap shut when something approaches quickly. */
class ShutterFerns implements LifeForm {
  scannables: Scannable[] = [];
  private readonly ferns: { mesh: Mesh; open: boolean; calm: number }[] = [];
  private readonly openMat: StandardMaterial;
  private readonly closedMat: StandardMaterial;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    this.openMat = mat(scene, "fernOpen", 0.45, 0.75, 0.2);
    this.openMat.emissiveColor = new Color3(0.12, 0.16, 0.02);
    this.closedMat = mat(scene, "fernClosed", 0.16, 0.36, 0.14);
    for (let x = -50; x < 40; x += 7 + (Math.abs(x) % 5)) {
      for (const z of [-4.6, 4.6]) {
        const mesh = MeshBuilder.CreateCylinder(
          `fern${x}${z}`,
          { diameterTop: 1.2, diameterBottom: 0.1, height: 0.7, tessellation: 6 },
          scene,
        );
        mesh.position.set(x, 0.35, z);
        const fern = { mesh, open: true, calm: 0 };
        this.ferns.push(fern);
        this.scannables.push({
          entryId: "shutter-fern",
          meshes: [mesh],
          getPosition: () => mesh.position,
          isConditionMet: () => fern.open && Vector3.Distance(mesh.position, this.ctx.robot.position) <= 6,
        });
      }
    }
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const speed = this.ctx.robotSpeed;
    const triggerRadius = this.ctx.robot.isSprinting ? 8 : speed > 3 ? 4 : speed > 0.1 ? 1.2 : 0;
    for (const f of this.ferns) {
      const near = Vector3.Distance(f.mesh.position, robot) < triggerRadius;
      if (near) {
        f.open = false;
        f.calm = 0;
      } else if (!f.open) {
        f.calm += dt;
        if (f.calm > 3) f.open = true;
      }
      const target = f.open ? 1 : 0.45;
      const s = f.mesh.scaling;
      const k = Math.min(1, dt * (f.open ? 2 : 14));
      s.x += (target - s.x) * k;
      s.z = s.x;
      s.y += ((f.open ? 1 : 0.6) - s.y) * k;
      f.mesh.material = f.open ? this.openMat : this.closedMat;
    }
  }
}

/** Lotus in the flooded pothole; turns with the sun. */
class SunLotus implements LifeForm {
  scannables: Scannable[];
  private readonly pads: TransformNode;
  private readonly bloom: Mesh;
  static readonly POS = new Vector3(25, 0, -1.5);

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const padMat = mat(scene, "lotusPad", 0.22, 0.5, 0.18);
    const bloomMat = mat(scene, "lotusBloom", 0.95, 0.75, 0.82);
    const stemMat = mat(scene, "lotusStem", 0.3, 0.45, 0.2);
    this.pads = new TransformNode("lotusPads", scene);
    this.pads.position.copyFrom(SunLotus.POS);
    const meshes: Mesh[] = [];
    for (const [dx, dz, r] of [[0.6, 0.3, 0.5], [-0.7, -0.5, 0.45], [0.1, -1, 0.4], [-0.3, 0.8, 0.35]]) {
      const pad = MeshBuilder.CreateDisc(`lotusPad${dx}`, { radius: r, tessellation: 12, arc: 0.9 }, scene);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(dx, 0.06, dz);
      pad.parent = this.pads;
      pad.material = padMat;
      meshes.push(pad);
    }
    const stem = MeshBuilder.CreateCylinder("lotusStem", { diameter: 0.06, height: 0.9 }, scene);
    stem.position.set(0, 0.45, 0);
    stem.parent = this.pads;
    stem.material = stemMat;
    this.bloom = MeshBuilder.CreateSphere("lotusBloom", { diameter: 0.45, segments: 8 }, scene);
    this.bloom.position.set(0.1, 0.95, 0);
    this.bloom.parent = this.pads;
    this.bloom.material = bloomMat;
    meshes.push(stem, this.bloom);

    this.scannables = [
      {
        entryId: "sun-lotus",
        meshes,
        getPosition: () => SunLotus.POS.add(new Vector3(0, 0.6, 0)),
        // Observed once it has been scanned at two clearly different times of day.
        isConditionMet: () => {
          const now = this.ctx.time.hours;
          return this.ctx.logbook.get("sun-lotus").scanHours.some((h) => hourDistance(h, now) >= 4);
        },
      },
    ];
  }

  update(): void {
    const hours = this.ctx.time.hours;
    this.pads.rotation.y = ((hours - 6) / 12) * Math.PI;
    const open = 0.45 + 0.55 * this.ctx.time.daylight;
    this.bloom.scaling.set(open, 0.8 + 0.2 * open, open);
  }
}

/** Moss on the shrine statues that whistles in the wind. */
class ChoirMoss implements LifeForm {
  scannables: Scannable[] = [];
  private readonly stalks: Mesh[] = [];
  private announced = false;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const mossMat = mat(scene, "choirMoss", 0.3, 0.5, 0.2);
    const stalkMat = mat(scene, "choirStalk", 0.55, 0.65, 0.35);
    for (const z of [-3.5, 3.5]) {
      const cap = MeshBuilder.CreateSphere(`choirMoss${z}`, { diameter: 0.95, segments: 8 }, scene);
      cap.scaling.y = 0.4;
      cap.position.set(47.5, 2.05, z);
      cap.material = mossMat;
      const meshes: Mesh[] = [cap];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const stalk = MeshBuilder.CreateCylinder(`choirStalk${z}${i}`, { diameter: 0.035, height: 0.18 + (i % 3) * 0.08 }, scene);
        stalk.position.set(47.5 + Math.cos(a) * 0.25, 2.25, z + Math.sin(a) * 0.25);
        stalk.material = stalkMat;
        this.stalks.push(stalk);
        meshes.push(stalk);
      }
      this.scannables.push({
        entryId: "choir-moss",
        meshes,
        getPosition: () => cap.position,
        isConditionMet: () => this.ctx.wind.gusting,
      });
    }
    ctx.wind.onGust((gusting) => {
      if (!gusting) return;
      const near = Vector3.Distance(this.ctx.robot.position, new Vector3(47.5, 0, 0)) < 35;
      if (near) this.ctx.caption("♪ A soft whistling chord drifts from the shrine", 7);
      else if (!this.announced) this.ctx.caption("Wind gusts through the street", 4);
      this.announced = true;
    });
  }

  update(): void {
    const t = performance.now() / 1000;
    const s = this.ctx.wind.strength;
    this.stalks.forEach((stalk, i) => {
      stalk.rotation.x = Math.sin(t * 9 + i) * 0.35 * s;
      stalk.rotation.z = Math.cos(t * 7 + i * 2) * 0.35 * s;
    });
  }
}

function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}
