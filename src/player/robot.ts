import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { Input } from "../input";

const WALK_SPEED = 4;
const SPRINT_SPEED = 7.5;
const JUMP_VELOCITY = 6.5;
const GRAVITY = -20;
const TURN_RATE = 12;
const BODY_HEIGHT = 1.4;

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
  private grounded = false;
  private sprinting = false;

  constructor(scene: Scene, spawn: Vector3) {
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

  setBodyVisible(visible: boolean): void {
    for (const m of this.bodyMeshes) m.isVisible = visible;
  }

  /**
   * @param yaw camera yaw in radians; movement is relative to it.
   * @param faceCamera in first person the body always faces where the camera looks.
   */
  update(dt: number, input: Input, yaw: number, faceCamera: boolean): void {
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(forward.z, 0, -forward.x);
    const move = Vector3.Zero();
    if (input.isDown("KeyW")) move.addInPlace(forward);
    if (input.isDown("KeyS")) move.subtractInPlace(forward);
    if (input.isDown("KeyD")) move.addInPlace(right);
    if (input.isDown("KeyA")) move.subtractInPlace(right);

    const moving = move.lengthSquared() > 0;
    this.sprinting = moving && (input.isDown("ShiftLeft") || input.isDown("ShiftRight"));
    if (moving) move.normalize().scaleInPlace(this.sprinting ? SPRINT_SPEED : WALK_SPEED);

    if (this.grounded && input.wasPressed("Space")) {
      this.verticalVelocity = JUMP_VELOCITY;
      this.grounded = false;
    }
    this.verticalVelocity += GRAVITY * dt;

    const displacement = new Vector3(move.x * dt, this.verticalVelocity * dt, move.z * dt);
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
    if (this.collider.position.y < -20) {
      this.collider.position.set(0, 2, 0);
      this.verticalVelocity = 0;
    }

    const targetYaw = faceCamera ? yaw : moving ? Math.atan2(move.x, move.z) : this.visual.rotation.y;
    this.visual.rotation.y = lerpAngle(this.visual.rotation.y, targetYaw, Math.min(1, TURN_RATE * dt));
  }

  private buildBody(scene: Scene): void {
    const shell = new StandardMaterial("robotShell", scene);
    shell.diffuseColor = new Color3(0.82, 0.84, 0.86);
    shell.specularColor = new Color3(0.4, 0.4, 0.4);
    const dark = new StandardMaterial("robotDark", scene);
    dark.diffuseColor = new Color3(0.15, 0.16, 0.18);
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
    add(MeshBuilder.CreateCylinder("robotLens", { diameter: 0.2, height: 0.08 }, scene), glow, 1.34, 0.24)
      .rotation.x = Math.PI / 2;
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
