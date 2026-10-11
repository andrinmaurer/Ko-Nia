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
} from "@babylonjs/core";
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
 * Placeholder robot (the real design comes from the robot stylesheet later)
 * and its character controller. The collider is an invisible ellipsoid moved
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
    return horizontalDistance(start, this.collider.position);
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

  private buildBody(scene: Scene): void {
    const shell = new StandardMaterial("robotShell", scene);
    shell.diffuseColor = Color3.FromHexString("#d8cfc6"); // mat-ceramic
    shell.specularColor = new Color3(0.4, 0.4, 0.4);
    const dark = new StandardMaterial("robotDark", scene);
    dark.diffuseColor = Color3.FromHexString("#635f5c"); // mat-graphite
    const glow = new StandardMaterial("robotGlow", scene);
    glow.emissiveColor = new Color3(0.35, 0.85, 1);
    glow.disableLighting = true;

    const add = (mesh: Mesh, mat: StandardMaterial, y: number, z = 0) => {
      mesh.material = mat;
      mesh.parent = this.visual;
      mesh.position.set(0, y, z);
      mesh.isPickable = false;
      this.bodyMeshes.push(mesh);
      return mesh;
    };

    add(MeshBuilder.CreateCapsule("robotBody", { height: 0.85, radius: 0.32 }, scene), shell, 0.75);
    add(MeshBuilder.CreateSphere("robotHead", { diameter: 0.5 }, scene), shell, 1.32);
    // Twin camera lenses: the only cyan in the world.
    for (const x of [-0.09, 0.09]) {
      const lens = add(MeshBuilder.CreateCylinder("robotLens", { diameter: 0.12, height: 0.08 }, scene), glow, 1.34, 0.23);
      lens.rotation.x = Math.PI / 2;
      lens.position.x = x;
    }
    const legL = add(MeshBuilder.CreateBox("robotLegL", { width: 0.14, height: 0.4, depth: 0.14 }, scene), dark, 0.2);
    legL.position.x = -0.16;
    const legR = add(MeshBuilder.CreateBox("robotLegR", { width: 0.14, height: 0.4, depth: 0.14 }, scene), dark, 0.2);
    legR.position.x = 0.16;
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
