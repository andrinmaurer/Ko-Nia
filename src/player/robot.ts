import {
  AbstractMesh,
  Color3,
  Mesh,
  MeshBuilder,
  Ray,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "../babylon";
import type { Input } from "../input";

const WALK_SPEED = 4;
const SPRINT_SPEED = 7.5;
const DEPLETED_SPEED = 2;
const JUMP_VELOCITY = 6.5;
const GRAVITY = -20;
const TURN_RATE = 12;
const BODY_HEIGHT = 1.4;
/** Highest ledge (above the feet) the robot can pull itself onto. */
const MANTLE_REACH = 2.1;
const MANTLE_MIN = 0.45;
const MANTLE_DURATION = 0.45;

export interface MoveOptions {
  canSprint: boolean;
  depleted: boolean;
}

interface Mantle {
  from: Vector3;
  to: Vector3;
  t: number;
}

/**
 * Player robot: placeholder body built from primitives and its character controller. The collider is an invisible ellipsoid moved
 * with Babylon's built-in collision system.
 */
export class Robot {
  readonly collider: Mesh;
  readonly visual: TransformNode;
  private readonly bodyMeshes: Mesh[] = [];
  private verticalVelocity = 0;
  private readonly knockback = Vector3.Zero();
  private grounded = false;
  private sprinting = false;
  private mantle: Mantle | undefined;
  private pelvis!: TransformNode;
  private head!: TransformNode;
  private readonly arms: { shoulder: TransformNode; elbow: TransformNode }[] = [];
  private readonly legs: { hip: TransformNode; knee: TransformNode }[] = [];
  private walkPhase = 0;
  private walkBlend = 0;

  constructor(private readonly scene: Scene, spawn: Vector3) {
    this.collider = MeshBuilder.CreateBox("robotCollider", { size: 0.1 }, scene);
    this.collider.isVisible = false;
    this.collider.isPickable = false;
    this.collider.checkCollisions = false;
    this.collider.ellipsoid = new Vector3(0.4, BODY_HEIGHT / 2, 0.4);
    this.collider.ellipsoidOffset = new Vector3(0, BODY_HEIGHT / 2, 0);
    this.collider.position.copyFrom(spawn);

    this.visual = new TransformNode("robotVisual", scene);
    this.visual.parent = this.collider;
    this.buildBody(scene);
  }

  get position(): Vector3 {
    return this.collider.position;
  }

  get eyePosition(): Vector3 {
    return this.collider.position.add(new Vector3(0, BODY_HEIGHT - 0.15, 0));
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get isSprinting(): boolean {
    return this.sprinting;
  }

  get isMantling(): boolean {
    return this.mantle !== undefined;
  }

  setBodyVisible(visible: boolean): void {
    for (const m of this.bodyMeshes) m.isVisible = visible;
  }

  teleport(position: Vector3, yaw: number): void {
    this.collider.position.copyFrom(position);
    this.visual.rotation.y = yaw;
    this.verticalVelocity = 0;
    this.knockback.setAll(0);
    this.mantle = undefined;
  }

  push(impulse: Vector3): void {
    this.knockback.addInPlace(impulse);
    this.verticalVelocity = Math.max(this.verticalVelocity, 3);
  }

  /**
   * @param yaw camera yaw in radians; movement is relative to it.
   * @param faceCamera in first person the body always faces where the camera looks.
   * @returns horizontal metres moved this frame.
   */
  update(dt: number, input: Input, yaw: number, faceCamera: boolean, opts: MoveOptions): number {
    const start = this.collider.position.clone();
    if (this.mantle) {
      this.updateMantle(dt);
      this.animate(dt, 0);
      return horizontalDistance(start, this.collider.position);
    }

    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(forward.z, 0, -forward.x);
    const move = Vector3.Zero();
    if (input.isDown("KeyW")) move.addInPlace(forward);
    if (input.isDown("KeyS")) move.subtractInPlace(forward);
    if (input.isDown("KeyD")) move.addInPlace(right);
    if (input.isDown("KeyA")) move.subtractInPlace(right);

    const moving = move.lengthSquared() > 0;
    const wantsSprint = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    this.sprinting = moving && wantsSprint && opts.canSprint && !opts.depleted;
    const speed = opts.depleted ? DEPLETED_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (moving) move.normalize();
    const facing = moving ? move.clone() : new Vector3(Math.sin(this.visual.rotation.y), 0, Math.cos(this.visual.rotation.y));

    if (input.wasPressed("Space")) {
      if (this.grounded && !this.tryMantle(facing, true)) {
        this.verticalVelocity = JUMP_VELOCITY;
        this.grounded = false;
      }
    }
    // Holding forward against a ledge while in the air grabs it.
    if (!this.grounded && moving && this.verticalVelocity < 2.5 && this.tryMantle(facing, false)) {
      this.animate(dt, 0);
      return horizontalDistance(start, this.collider.position);
    }

    this.verticalVelocity += GRAVITY * dt;
    this.knockback.scaleInPlace(Math.max(0, 1 - 6 * dt));

    const displacement = new Vector3(
      (move.x * speed + this.knockback.x) * dt,
      this.verticalVelocity * dt,
      (move.z * speed + this.knockback.z) * dt,
    );
    const before = this.collider.position.y;
    // Collisions read the world matrix, which may be stale if the position was set directly.
    this.collider.computeWorldMatrix(true);
    this.collider.moveWithCollisions(displacement);
    const actualDy = this.collider.position.y - before;

    // If we were falling but moved less than intended, something is underneath us.
    if (displacement.y < 0 && actualDy > displacement.y + 1e-4) {
      this.grounded = true;
      this.verticalVelocity = 0;
    } else if (displacement.y > 0 && actualDy < displacement.y - 1e-4) {
      // Bumped our head.
      this.verticalVelocity = 0;
    } else {
      this.grounded = false;
    }

    // Safety net: never fall out of the world.
    if (this.collider.position.y < -20) this.teleport(new Vector3(0, 2, 0), 0);

    const targetYaw = faceCamera ? yaw : moving ? Math.atan2(move.x, move.z) : this.visual.rotation.y;
    this.visual.rotation.y = lerpAngle(this.visual.rotation.y, targetYaw, Math.min(1, TURN_RATE * dt));
    const moved = horizontalDistance(start, this.collider.position);
    this.animate(dt, moved);
    return moved;
  }

  /** Looks for a ledge in front of the robot and starts climbing onto it. */
  private tryMantle(dir: Vector3, fromGround: boolean): boolean {
    const pos = this.collider.position;
    const solid = (m: AbstractMesh) => m.checkCollisions && m !== this.collider;
    const wall = this.scene.pickWithRay(new Ray(pos.add(new Vector3(0, 0.8, 0)), dir, 0.9), solid);
    if (!wall?.hit) return false;

    const probe = pos.add(dir.scale(wall.distance + 0.45)).add(new Vector3(0, MANTLE_REACH + 0.2, 0));
    const top = this.scene.pickWithRay(new Ray(probe, Vector3.Down(), MANTLE_REACH + 0.2), solid);
    if (!top?.hit || !top.pickedPoint) return false;
    const rise = top.pickedPoint.y - pos.y;
    // From the ground, low steps are just walked over; mantling is for real ledges.
    if (rise < (fromGround ? 0.9 : MANTLE_MIN) || rise > MANTLE_REACH) return false;

    // Make sure the robot fits on top.
    const landing = top.pickedPoint.add(new Vector3(0, 0.05, 0));
    const headroom = this.scene.pickWithRay(new Ray(landing, Vector3.Up(), BODY_HEIGHT), solid);
    if (headroom?.hit) return false;

    this.mantle = { from: pos.clone(), to: landing, t: 0 };
    this.verticalVelocity = 0;
    this.visual.rotation.y = Math.atan2(dir.x, dir.z);
    return true;
  }

  private updateMantle(dt: number): void {
    const m = this.mantle!;
    m.t = Math.min(1, m.t + dt / MANTLE_DURATION);
    // Rise first, then move forward over the edge.
    const up = Math.min(1, m.t / 0.6);
    const across = Math.max(0, (m.t - 0.4) / 0.6);
    this.collider.position.set(
      m.from.x + (m.to.x - m.from.x) * across,
      m.from.y + (m.to.y - m.from.y) * easeOut(up),
      m.from.z + (m.to.z - m.from.z) * across,
    );
    if (m.t >= 1) {
      this.mantle = undefined;
      this.grounded = true;
    }
  }

  /**
   * Placeholder body after the player-robot reference sheet: slim biped, about
   * 1.6 m, wide binocular head on a thin neck, ceramic shell over graphite joints.
   */
  private buildBody(scene: Scene): void {
    const shell = new StandardMaterial("robotShell", scene);
    shell.diffuseColor = Color3.FromHexString("#d8cfc6"); // mat-ceramic
    shell.specularColor = new Color3(0.25, 0.25, 0.25);
    const dark = new StandardMaterial("robotDark", scene);
    dark.diffuseColor = Color3.FromHexString("#635f5c"); // mat-graphite
    dark.specularColor = new Color3(0.3, 0.3, 0.3);
    const joint = new StandardMaterial("robotJoint", scene);
    joint.diffuseColor = Color3.FromHexString("#262626"); // flexible joints
    const glow = new StandardMaterial("robotGlow", scene);
    glow.emissiveColor = new Color3(0.55, 0.92, 1); // accent lights, cyan-white
    glow.disableLighting = true;

    const part = (mesh: Mesh, mat: StandardMaterial, parent: TransformNode, x = 0, y = 0, z = 0) => {
      mesh.material = mat;
      mesh.parent = parent;
      mesh.position.set(x, y, z);
      mesh.isPickable = false;
      this.bodyMeshes.push(mesh);
      return mesh;
    };
    const node = (name: string, parent: TransformNode, x: number, y: number, z = 0) => {
      const n = new TransformNode(name, scene);
      n.parent = parent;
      n.position.set(x, y, z);
      return n;
    };
    /** A limb segment hanging down from its joint node. */
    const limb = (parent: TransformNode, length: number, radius: number, mat: StandardMaterial) => {
      part(MeshBuilder.CreateSphere("robotJoint", { diameter: radius * 2.4, segments: 6 }, scene), joint, parent);
      const seg = part(MeshBuilder.CreateCapsule("robotLimb", { height: length, radius, tessellation: 8, subdivisions: 1 }, scene), mat, parent, 0, -length / 2);
      return seg;
    };

    this.pelvis = node("robotPelvis", this.visual, 0, 0.86);
    part(MeshBuilder.CreateCylinder("robotHips", { diameterTop: 0.26, diameterBottom: 0.2, height: 0.16, tessellation: 8 }, scene), dark, this.pelvis);
    // Torso: tapered ceramic shell over a graphite spine.
    const chest = part(MeshBuilder.CreateCylinder("robotChest", { diameterTop: 0.42, diameterBottom: 0.24, height: 0.46, tessellation: 10 }, scene), shell, this.pelvis, 0, 0.36);
    chest.scaling.z = 0.68;
    part(MeshBuilder.CreateCylinder("robotSpine", { diameter: 0.12, height: 0.3, tessellation: 6 }, scene), dark, this.pelvis, 0, 0.12);
    const core = part(MeshBuilder.CreateBox("robotCoreLight", { width: 0.03, height: 0.16, depth: 0.02 }, scene), glow, this.pelvis, 0, 0.34, 0.145);
    core.rotation.x = -0.15;
    // Solar plates on the back.
    for (const side of [-1, 1]) {
      const plate = part(MeshBuilder.CreateBox("robotSolar", { width: 0.18, height: 0.32, depth: 0.03 }, scene), joint, this.pelvis, side * 0.1, 0.4, -0.15);
      plate.rotation.set(0.15, side * 0.25, 0);
    }
    // Neck and head.
    part(MeshBuilder.CreateCylinder("robotNeck", { diameter: 0.05, height: 0.2, tessellation: 6 }, scene), joint, this.pelvis, 0, 0.68);
    this.head = node("robotHead", this.pelvis, 0, 0.84);
    const skull = part(MeshBuilder.CreateSphere("robotSkull", { diameter: 1, segments: 10 }, scene), shell, this.head);
    skull.scaling.set(0.44, 0.24, 0.32);
    for (const x of [-0.1, 0.1]) {
      const rim = part(MeshBuilder.CreateCylinder("robotLensRim", { diameter: 0.17, height: 0.1, tessellation: 14 }, scene), dark, this.head, x, -0.005, 0.12);
      rim.rotation.x = Math.PI / 2;
      // Twin camera lenses: the only cyan in the world.
      const lens = part(MeshBuilder.CreateCylinder("robotLens", { diameter: 0.09, height: 0.02, tessellation: 12 }, scene), glow, this.head, x, -0.005, 0.175);
      lens.rotation.x = Math.PI / 2;
    }
    part(MeshBuilder.CreateSphere("robotSensor", { diameter: 0.05, segments: 6 }, scene), dark, this.head, 0, 0.1, 0.05);

    // Arms: long, reaching to the knees.
    for (const side of [-1, 1]) {
      const shoulder = node("robotShoulder", this.pelvis, side * 0.22, 0.56);
      part(MeshBuilder.CreateSphere("robotPauldron", { diameter: 0.15, segments: 6 }, scene), shell, shoulder);
      limb(shoulder, 0.3, 0.035, shell);
      const elbow = node("robotElbow", shoulder, 0, -0.32);
      limb(elbow, 0.28, 0.03, dark);
      const hand = part(MeshBuilder.CreateBox("robotHand", { width: 0.05, height: 0.12, depth: 0.08 }, scene), joint, elbow, 0, -0.34);
      hand.rotation.x = 0.2;
      this.arms.push({ shoulder, elbow });
    }
    // Legs with a split foot.
    for (const side of [-1, 1]) {
      const hip = node("robotHip", this.pelvis, side * 0.1, -0.06);
      limb(hip, 0.38, 0.05, shell);
      const knee = node("robotKnee", hip, 0, -0.4);
      limb(knee, 0.36, 0.04, dark);
      for (const toe of [-0.03, 0.03]) {
        const foot = part(MeshBuilder.CreateBox("robotToe", { width: 0.04, height: 0.04, depth: 0.16 }, scene), joint, knee, toe, -0.4, 0.05);
        foot.rotation.y = toe * 3;
      }
      this.legs.push({ hip, knee });
    }
  }

  /** Procedural walk cycle, driven by how far the robot moved this frame. */
  private animate(dt: number, moved: number): void {
    const speed = dt > 0 ? moved / dt : 0;
    const stride = Math.min(1, speed / WALK_SPEED);
    this.walkPhase += moved * 3.2;
    this.walkBlend += (stride - this.walkBlend) * Math.min(1, dt * 10);
    const b = this.walkBlend;
    const t = performance.now() / 1000;
    for (let i = 0; i < 2; i++) {
      const phase = this.walkPhase + i * Math.PI;
      const swing = Math.sin(phase) * 0.6 * b;
      this.legs[i].hip.rotation.x = this.grounded ? swing : -0.5;
      this.legs[i].knee.rotation.x = this.grounded ? Math.max(0, -Math.cos(phase)) * 0.9 * b + 0.05 : 0.9;
      this.arms[i].shoulder.rotation.x = -swing * 0.7;
      this.arms[i].shoulder.rotation.z = (i === 0 ? 1 : -1) * 0.06;
      this.arms[i].elbow.rotation.x = -0.25 - 0.2 * b;
    }
    // Bob while walking, breathe-like sway while idle, look slightly around.
    this.pelvis.position.y = 0.86 + Math.abs(Math.sin(this.walkPhase)) * 0.04 * b + Math.sin(t * 1.6) * 0.006 * (1 - b);
    this.pelvis.rotation.x = 0.12 * b * (this.sprinting ? 1.6 : 1);
    this.head.rotation.y = Math.sin(t * 0.4) * 0.25 * (1 - b);
    this.head.rotation.x = -this.pelvis.rotation.x * 0.8;
  }
}

function lerpAngle(from: number, to: number, t: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function horizontalDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}
