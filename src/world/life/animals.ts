import {
  AbstractMesh,
  Color3,
  Mesh,
  MeshBuilder,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { mat } from "./materials";

/** The MVP animals plus the dangerous Vault Mantis. */
export function createAnimals(ctx: GameContext, shadows: ShadowGenerator): LifeForm[] {
  const hookbills = [-2.2, 0.3, 2.8].map((z, i) => new Hookbill(ctx, shadows, new Vector3(44, 5.35, z), i));
  return [...hookbills, new LanternMoths(ctx), new Drainback(ctx, shadows), new VaultMantis(ctx, shadows)];
}

// ---------------------------------------------------------------------------
// Hookbill: crow descendant nesting on the torii, collects shiny objects.

type BirdState = "perched" | "flyOut" | "forage" | "carry" | "flee";

class Hookbill implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly trinket: Mesh;
  private state: BirdState = "perched";
  private timer: number;
  private flight?: { from: Vector3; to: Vector3; t: number; duration: number };
  private forageTarget = Vector3.Zero();

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator, private readonly nest: Vector3, index: number) {
    const scene = ctx.scene;
    const black = mat(scene, "hookbillFeathers", 0.08, 0.08, 0.1, 0.5);
    black.specularColor = new Color3(0.55, 0.35, 0.2); // copper sheen
    const beakMat = mat(scene, "hookbillBeak", 0.35, 0.33, 0.3);
    const nestMat = mat(scene, "hookbillNest", 0.35, 0.25, 0.15);

    const nestMesh = MeshBuilder.CreateTorus(`hookbillNest${index}`, { diameter: 0.7, thickness: 0.2, tessellation: 12 }, scene);
    nestMesh.position.copyFrom(nest);
    nestMesh.material = nestMat;
    nestMesh.isPickable = false;

    this.node = new TransformNode(`hookbill${index}`, scene);
    this.node.position.copyFrom(nest);
    const body = MeshBuilder.CreateSphere(`hookbillBody${index}`, { diameter: 1, segments: 8 }, scene);
    body.scaling.set(0.35, 0.32, 0.62);
    body.position.y = 0.25;
    const head = MeshBuilder.CreateSphere(`hookbillHead${index}`, { diameter: 0.24, segments: 8 }, scene);
    head.position.set(0, 0.45, 0.3);
    const beak = MeshBuilder.CreateCylinder(`hookbillBeak${index}`, { diameterTop: 0, diameterBottom: 0.09, height: 0.28 }, scene);
    beak.rotation.x = Math.PI / 2 + 0.4;
    beak.position.set(0, 0.42, 0.5);
    const parts = [body, head, beak];
    body.material = black;
    head.material = black;
    beak.material = beakMat;
    for (const p of parts) {
      p.parent = this.node;
      shadows.addShadowCaster(p);
    }
    this.trinket = MeshBuilder.CreateCylinder(`hookbillTrinket${index}`, { diameter: 0.12, height: 0.03 }, scene);
    this.trinket.material = mat(scene, "trinket", 0.8, 0.75, 0.6, 0.9);
    this.trinket.parent = this.node;
    this.trinket.position.set(0, 0.36, 0.62);
    this.trinket.isVisible = false;

    // Stagger the birds so their trips overlap less.
    this.timer = 6 + index * 9;
    this.scannables = [
      {
        entryId: "hookbill",
        meshes: parts,
        getPosition: () => this.node.position.add(new Vector3(0, 0.3, 0)),
        isConditionMet: () => this.state === "carry",
      },
    ];
  }

  update(dt: number): void {
    const robotDist = Vector3.Distance(this.ctx.robot.position, this.node.position);
    const night = this.ctx.time.isNight;
    this.timer -= dt;

    switch (this.state) {
      case "perched":
        if (this.timer <= 0 && !night) {
          this.forageTarget = new Vector3(30 + Math.random() * 12, 0, -4 + Math.random() * 8);
          this.fly(this.forageTarget, 2.5, "flyOut");
        }
        break;
      case "forage": {
        if ((this.ctx.robot.isSprinting && robotDist < 10) || robotDist < 2.5) {
          this.trinket.isVisible = false;
          this.fly(this.nest, 1.6, "flee");
          this.ctx.caption("A Hookbill caws and takes off", 2.5);
          break;
        }
        if (night || this.timer <= 0) {
          this.trinket.isVisible = true;
          this.fly(this.nest, 4.5, "carry");
          break;
        }
        // Hop between nearby spots.
        const to = this.forageTarget.subtract(this.node.position);
        to.y = 0;
        if (to.length() < 0.2) {
          this.forageTarget = this.node.position.add(new Vector3(Math.random() * 3 - 1.5, 0, Math.random() * 3 - 1.5));
          this.forageTarget.z = Math.max(-4.5, Math.min(4.5, this.forageTarget.z));
        } else {
          const step = to.normalize().scale(Math.min(to.length(), 1.2 * dt));
          this.node.position.addInPlace(step);
          this.node.rotation.y = Math.atan2(to.x, to.z);
          this.node.position.y = Math.abs(Math.sin(performance.now() / 120)) * 0.08;
        }
        break;
      }
      case "flyOut":
      case "carry":
      case "flee":
        this.updateFlight(dt);
        break;
    }
  }

  private fly(to: Vector3, duration: number, state: BirdState): void {
    this.flight = { from: this.node.position.clone(), to: to.clone(), t: 0, duration };
    this.state = state;
  }

  private updateFlight(dt: number): void {
    const f = this.flight!;
    f.t = Math.min(1, f.t + dt / f.duration);
    const p = Vector3.Lerp(f.from, f.to, f.t);
    p.y += Math.sin(f.t * Math.PI) * 3;
    const dir = f.to.subtract(f.from);
    this.node.rotation.y = Math.atan2(dir.x, dir.z);
    this.node.position.copyFrom(p);
    if (f.t < 1) return;
    if (this.state === "flyOut") {
      this.state = "forage";
      this.timer = 8 + Math.random() * 5;
    } else {
      this.state = "perched";
      this.trinket.isVisible = false;
      this.timer = 15 + Math.random() * 15;
      this.node.rotation.y = Math.PI / 2;
    }
  }
}

// ---------------------------------------------------------------------------
// Lantern Moths: rest under the overpass by day, swarm the wisteria at night.

class LanternMoths implements LifeForm {
  scannables: Scannable[] = [];
  private readonly moths: { node: TransformNode; wings: Mesh[]; rest: Vector3; phase: number; radius: number }[] = [];
  private readonly markMat: StandardMaterial;
  /** 0 = resting, 1 = swarming. */
  private swarm = 0;
  private static readonly CENTER = new Vector3(-4.5, 3.6, 0.75);

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    const wingMat = mat(scene, "mothWing", 0.55, 0.52, 0.45);
    wingMat.alpha = 0.85;
    wingMat.backFaceCulling = false;
    this.markMat = mat(scene, "mothMark", 0.3, 0.3, 0.25);
    for (let i = 0; i < 12; i++) {
      const node = new TransformNode(`moth${i}`, scene);
      const rest = new Vector3(-5.5 + (i % 3) * 0.9, 5.5, -2.8 + Math.floor(i / 3) * 1.9);
      node.position.copyFrom(rest);
      const wings: Mesh[] = [];
      for (const side of [-1, 1]) {
        const wing = MeshBuilder.CreatePlane(`mothWing${i}${side}`, { width: 0.16, height: 0.12 }, scene);
        wing.rotation.x = Math.PI / 2;
        wing.position.x = side * 0.08;
        wing.parent = node;
        wing.material = wingMat;
        wings.push(wing);
      }
      const body = MeshBuilder.CreateSphere(`mothBody${i}`, { diameter: 0.06, segments: 4 }, scene);
      body.scaling.z = 2;
      body.parent = node;
      body.material = this.markMat;
      this.moths.push({ node, wings, rest, phase: i * 0.7, radius: 1 + (i % 4) * 0.45 });
      this.scannables.push({
        entryId: "lantern-moth",
        meshes: [...wings, body],
        getPosition: () => node.position,
        isConditionMet: () => this.ctx.time.isNight && this.swarm > 0.95,
      });
    }
  }

  update(dt: number): void {
    const night = this.ctx.time.isNight;
    this.swarm = Math.max(0, Math.min(1, this.swarm + (night ? dt : -dt) / 4));
    const glow = 1 - this.ctx.time.daylight;
    this.markMat.emissiveColor.set(0.2 * glow, 0.8 * glow, 0.7 * glow);
    const t = performance.now() / 1000;
    for (const m of this.moths) {
      const a = t * 0.8 + m.phase;
      const orbit = LanternMoths.CENTER.add(
        new Vector3(Math.cos(a) * m.radius * 0.6, Math.sin(a * 1.7) * 0.6, Math.sin(a) * m.radius * 1.6),
      );
      m.node.position = Vector3.Lerp(m.rest, orbit, this.swarm);
      m.node.rotation.y = a + Math.PI / 2;
      const flap = this.swarm > 0.05 ? Math.sin(t * 25 + m.phase) * 0.9 : 0;
      m.wings[0].rotation.z = flap;
      m.wings[1].rotation.z = -flap;
    }
  }
}

// ---------------------------------------------------------------------------
// Drainback: armored rat descendant living in an alley drain.

type DrainState = "hidden" | "peek" | "forage" | "flee";

class Drainback implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly parts: Mesh[] = [];
  private state: DrainState = "hidden";
  private still = 0;
  private timer = 0;
  private target = Vector3.Zero();
  private static readonly DRAIN = new Vector3(0.75, 0, -22.75);

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const skin = mat(scene, "drainbackSkin", 0.4, 0.33, 0.3);
    const plate = mat(scene, "drainbackPlate", 0.32, 0.34, 0.32, 0.3);
    this.node = new TransformNode("drainback", scene);
    const body = MeshBuilder.CreateSphere("drainbackBody", { diameter: 1, segments: 8 }, scene);
    body.scaling.set(0.45, 0.35, 0.8);
    body.position.y = 0.25;
    body.material = skin;
    const head = MeshBuilder.CreateSphere("drainbackHead", { diameter: 0.3, segments: 8 }, scene);
    head.scaling.z = 1.4;
    head.position.set(0, 0.28, 0.5);
    head.material = skin;
    const tail = MeshBuilder.CreateCylinder("drainbackTail", { diameterTop: 0.02, diameterBottom: 0.07, height: 0.7 }, scene);
    tail.rotation.x = -Math.PI / 2 + 0.2;
    tail.position.set(0, 0.18, -0.65);
    tail.material = skin;
    this.parts.push(body, head, tail);
    for (let i = 0; i < 4; i++) {
      const p = MeshBuilder.CreateBox(`drainbackPlate${i}`, { width: 0.5, height: 0.06, depth: 0.24 }, scene);
      p.position.set(0, 0.43 - Math.abs(i - 1.5) * 0.03, -0.25 + i * 0.18);
      p.rotation.x = -0.15;
      p.material = plate;
      this.parts.push(p);
    }
    for (const m of this.parts) {
      m.parent = this.node;
      shadows.addShadowCaster(m);
    }
    this.node.position.copyFrom(Drainback.DRAIN);
    this.setVisible(false);
    this.scannables = [
      {
        entryId: "drainback",
        meshes: this.parts,
        getPosition: () => this.node.position.add(new Vector3(0, 0.25, 0)),
        isAvailable: () => this.state === "peek" || this.state === "forage",
        isConditionMet: () => this.state === "forage",
      },
    ];
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const dist = Vector3.Distance(robot, this.node.position);
    const calm = this.ctx.robotSpeed < 0.3 && Vector3.Distance(robot, Drainback.DRAIN) < 14;
    this.still = calm ? this.still + dt : 0;
    const startled = (this.ctx.robotSpeed > 2.5 && dist < 10) || dist < 1.8;
    this.timer -= dt;

    switch (this.state) {
      case "hidden":
        this.node.position.y = -0.6;
        if (this.still > 3) {
          this.state = "peek";
          this.timer = 2.5;
          this.setVisible(true);
          this.ctx.caption("Something scratches inside the drain", 3);
        }
        break;
      case "peek":
        this.node.position.y = Math.min(-0.12, this.node.position.y + dt);
        if (startled) this.hide();
        else if (this.timer <= 0) {
          this.state = "forage";
          this.timer = 25;
          this.pickTarget();
        }
        break;
      case "forage": {
        this.node.position.y = 0;
        if (startled) {
          this.state = "flee";
          this.ctx.caption("A Drainback scurries away", 2);
          break;
        }
        if (this.timer <= 0) {
          this.state = "flee";
          break;
        }
        if (this.moveTowards(this.target, 0.9, dt)) this.pickTarget();
        break;
      }
      case "flee":
        if (this.moveTowards(Drainback.DRAIN, 6, dt)) this.hide();
        break;
    }
  }

  private hide(): void {
    this.state = "hidden";
    this.still = 0;
    this.node.position.copyFrom(Drainback.DRAIN);
    this.setVisible(false);
  }

  private pickTarget(): void {
    this.target = Drainback.DRAIN.add(new Vector3(Math.random() * 6 - 3, 0, Math.random() * 3 - 1));
    this.target.z = Math.max(-25.3, Math.min(-20.6, this.target.z));
  }

  /** @returns true once arrived */
  private moveTowards(target: Vector3, speed: number, dt: number): boolean {
    const to = target.subtract(this.node.position);
    to.y = 0;
    const len = to.length();
    if (len < 0.1) return true;
    this.node.position.addInPlace(to.scale(Math.min(1, (speed * dt) / len)));
    this.node.rotation.y = Math.atan2(to.x, to.z);
    return false;
  }

  private setVisible(v: boolean): void {
    for (const m of this.parts) m.isVisible = v;
  }
}

// ---------------------------------------------------------------------------
// Vault Mantis: ambush predator guarding an egg case in the noodle shop's back room.

type MantisState = "tending" | "warning" | "strike" | "cooldown";

const BACK_ROOM = { x0: 6.3, x1: 21.7, z0: 15.3, z1: 19.7 };

class VaultMantis implements LifeForm {
  scannables: Scannable[];
  private readonly node: TransformNode;
  private readonly arms: Mesh[] = [];
  private readonly body: TransformNode;
  private state: MantisState = "tending";
  private timer = 0;
  private hasHit = false;
  private static readonly HOME = new Vector3(15.5, 0, 18.2);

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    const camo = mat(scene, "mantisCamo", 0.36, 0.42, 0.33);
    const eggMat = mat(scene, "mantisEgg", 0.62, 0.52, 0.38);
    const egg = MeshBuilder.CreateSphere("mantisEggCase", { diameter: 0.7, segments: 8 }, scene);
    egg.scaling.set(1, 0.7, 1.4);
    egg.position.set(17.8, 0.25, 19);
    egg.material = eggMat;
    egg.isPickable = false;

    this.node = new TransformNode("vaultMantis", scene);
    this.node.position.copyFrom(VaultMantis.HOME);
    this.node.rotation.y = Math.PI; // faces the partition door (-z)
    this.body = new TransformNode("vaultMantisBody", scene);
    this.body.parent = this.node;

    const parts: Mesh[] = [];
    const add = (mesh: Mesh, parent: TransformNode = this.body) => {
      mesh.material = camo;
      mesh.parent = parent;
      shadows.addShadowCaster(mesh);
      parts.push(mesh);
      return mesh;
    };
    const abdomen = add(MeshBuilder.CreateSphere("mantisAbdomen", { diameter: 1, segments: 8 }));
    abdomen.scaling.set(0.45, 0.35, 1.1);
    abdomen.position.set(0, 0.55, -0.55);
    const thorax = add(MeshBuilder.CreateCylinder("mantisThorax", { diameterTop: 0.14, diameterBottom: 0.22, height: 0.8 }));
    thorax.rotation.x = 0.6;
    thorax.position.set(0, 0.85, 0.15);
    const head = add(MeshBuilder.CreateSphere("mantisHead", { diameter: 0.32, segments: 6 }));
    head.scaling.set(1.3, 0.8, 0.8);
    head.position.set(0, 1.22, 0.42);
    for (const side of [-1, 1]) {
      const arm = add(MeshBuilder.CreateBox(`mantisArm${side}`, { width: 0.08, height: 0.6, depth: 0.1 }));
      arm.position.set(side * 0.16, 0.9, 0.5);
      arm.rotation.x = -0.5;
      this.arms.push(arm);
      for (const z of [-0.6, 0, 0.4]) {
        const leg = add(MeshBuilder.CreateCylinder(`mantisLeg${side}${z}`, { diameter: 0.05, height: 0.9 }));
        leg.position.set(side * 0.35, 0.35, z - 0.2);
        leg.rotation.z = side * 0.9;
      }
    }

    this.scannables = [
      {
        entryId: "vault-mantis",
        meshes: parts,
        getPosition: () => this.node.position.add(new Vector3(0, 0.8, 0)),
        // Observed undisturbed from the roof, looking down through the hole.
        isConditionMet: () => this.state === "tending" && this.ctx.robot.position.y > 3.5,
      },
    ];
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const intruder =
      robot.y < 3 && robot.x > BACK_ROOM.x0 && robot.x < BACK_ROOM.x1 && robot.z > BACK_ROOM.z0 && robot.z < BACK_ROOM.z1;
    const t = performance.now() / 1000;
    this.timer -= dt;

    switch (this.state) {
      case "tending":
        this.body.rotation.z = Math.sin(t * 0.8) * 0.05;
        this.pose(0, dt);
        this.returnHome(dt);
        if (intruder) this.warn(2);
        break;
      case "warning":
        this.face(robot, dt);
        this.pose(1, dt);
        this.body.position.x = Math.sin(t * 60) * 0.02; // rattling
        if (!intruder) {
          this.state = "tending";
          this.body.position.x = 0;
        } else if (this.timer <= 0) {
          this.state = "strike";
          this.timer = 0.35;
          this.hasHit = false;
          this.body.position.x = 0;
        }
        break;
      case "strike": {
        const toRobot = robot.subtract(this.node.position);
        toRobot.y = 0;
        const lunge = Math.min(toRobot.length() - 0.8, 6 * dt);
        if (lunge > 0) this.node.position.addInPlace(toRobot.normalize().scale(lunge));
        if (!this.hasHit && Vector3.Distance(robot, this.node.position) < 1.6) {
          this.hasHit = true;
          // Shove the robot towards the partition door.
          const push = new Vector3(10, 0, 14).subtract(robot);
          push.y = 0;
          this.ctx.hitRobot(1, push.normalize().scale(9));
        }
        if (this.timer <= 0) {
          this.state = "cooldown";
          this.timer = 1.5;
        }
        break;
      }
      case "cooldown":
        this.pose(0.5, dt);
        if (this.timer <= 0) {
          if (intruder) this.warn(1);
          else this.state = "tending";
        }
        break;
    }
  }

  private warn(seconds: number): void {
    this.state = "warning";
    this.timer = seconds;
    this.ctx.caption("A dry rattling sound, very close", 2.5);
  }

  private face(target: Vector3, dt: number): void {
    const to = target.subtract(this.node.position);
    const yaw = Math.atan2(to.x, to.z);
    this.node.rotation.y += (yaw - this.node.rotation.y) * Math.min(1, dt * 8);
  }

  private pose(raised: number, dt: number): void {
    for (const arm of this.arms) arm.rotation.x += (-0.5 - raised * 1.2 - arm.rotation.x) * Math.min(1, dt * 10);
    this.body.position.y += (raised * 0.15 - this.body.position.y) * Math.min(1, dt * 10);
  }

  private returnHome(dt: number): void {
    const to = VaultMantis.HOME.subtract(this.node.position);
    if (to.length() > 0.05) this.node.position.addInPlace(to.scale(Math.min(1, dt)));
    this.node.rotation.y += (Math.PI - this.node.rotation.y) * Math.min(1, dt);
  }
}

// ---------------------------------------------------------------------------
// The Predecessor Unit and human artifacts (static, scan once).

export function createStaticDiscoveries(ctx: GameContext): Scannable[] {
  const scene = ctx.scene;
  const rust = mat(scene, "predecessorShell", 0.5, 0.4, 0.32, 0.2);
  const dead = mat(scene, "predecessorLens", 0.1, 0.12, 0.13);
  const ivy = mat(scene, "ivy", 0.45, 0.2, 0.12);
  const node = new TransformNode("predecessor", scene);
  node.position.set(-4.6, 6, 3.6);
  node.rotation.y = 0.4;
  const body = MeshBuilder.CreateCapsule("predecessorBody", { height: 0.85, radius: 0.32 }, scene);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.32;
  body.material = rust;
  const head = MeshBuilder.CreateSphere("predecessorHead", { diameter: 0.5 }, scene);
  head.position.set(0.65, 0.3, 0.1);
  head.material = rust;
  const lens = MeshBuilder.CreateCylinder("predecessorLens", { diameter: 0.2, height: 0.08 }, scene);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(0.9, 0.32, 0.1);
  lens.material = dead;
  const vines = MeshBuilder.CreateBox("predecessorIvy", { width: 1.2, height: 0.05, depth: 0.7 }, scene);
  vines.position.set(0.1, 0.62, 0);
  vines.rotation.x = 0.2;
  vines.material = ivy;
  const parts = [body, head, lens, vines];
  for (const p of parts) p.parent = node;
  body.checkCollisions = true;

  const byName = (...names: string[]): AbstractMesh[] =>
    names.map((n) => scene.getMeshByName(n)).filter((m): m is AbstractMesh => m !== null);
  const at = (meshes: AbstractMesh[]) => () => meshes[0].getAbsolutePosition();

  const vending = byName("shopVending");
  const menu = byName("shopMenuBoard");
  const torii = byName("toriiKasagi", "toriiNuki", "toriiPillar-2.6", "toriiPillar2.6");
  const statues = byName("statue-3.5", "statue3.5");
  return [
    { entryId: "origin-predecessor", meshes: parts, getPosition: () => node.position.add(new Vector3(0, 0.3, 0)) },
    { entryId: "art-vending-machine", meshes: vending, getPosition: at(vending) },
    { entryId: "art-menu-board", meshes: menu, getPosition: at(menu) },
    { entryId: "art-torii", meshes: torii, getPosition: at(torii) },
    ...statues.map((s) => ({ entryId: "art-statue", meshes: [s], getPosition: () => s.getAbsolutePosition() })),
  ];
}
