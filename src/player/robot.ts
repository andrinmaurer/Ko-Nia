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
  canClimb?: boolean;
  canHover?: boolean;
  canGlide?: boolean;
  spendEnergy?: (amount: number) => boolean;
  /** Multiplies walking and sprinting speed (wading through water). Default 1. */
  speedScale?: number;
}

interface Mantle {
  from: Vector3;
  to: Vector3;
  t: number;
}

/**
 * Player robot: body built from primitives and its character controller. The collider is an invisible ellipsoid moved
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
  private hoverRemaining = 3;
  private grapple: Vector3 | undefined;
  isHovering = false;
  isGliding = false;
  get isGrappling(): boolean { return !!this.grapple; }

  beginGrapple(ray: Ray): boolean {
    const solid = (m: AbstractMesh) => m.checkCollisions && m.isEnabled() && m !== this.collider;
    const hit = this.scene.pickWithRay(new Ray(ray.origin, ray.direction, 35), solid);
    if (!hit?.hit || !hit.pickedPoint || (hit.getNormal(true)?.y ?? 0) < 0.45) return false;
    const landing = hit.pickedPoint.add(new Vector3(0, 0.08, 0));
    if (this.scene.pickWithRay(new Ray(landing, Vector3.Up(), BODY_HEIGHT), solid)?.hit) return false;
    // Pull above the lip, then release so gravity settles the feet on the ledge.
    this.grapple = landing.add(new Vector3(0, BODY_HEIGHT, 0)); this.mantle = undefined; return true;
  }
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
    this.grapple = undefined; this.hoverRemaining = 3; this.isHovering = this.isGliding = false;
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
    this.isHovering = this.isGliding = false;
    if (this.grapple) {
      if (input.wasPressed("Space") || opts.depleted || !opts.spendEnergy?.(6 * dt)) this.grapple = undefined;
      else {
        const delta = this.grapple.subtract(start);
        const step = delta.normalizeToNew().scale(Math.min(delta.length(), 12 * dt));
        this.collider.computeWorldMatrix(true); this.collider.moveWithCollisions(step);
        if (Vector3.Distance(this.collider.position, this.grapple) < 0.2 || Vector3.Distance(start, this.collider.position) < step.length() * 0.2) this.grapple = undefined;
        this.verticalVelocity = 0; this.grounded = false; this.animate(dt, 0);
        return horizontalDistance(start, this.collider.position);
      }
    }
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
    let speed = (opts.depleted ? DEPLETED_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED) * (opts.speedScale ?? 1);
    if (moving) move.normalize();
    const facing = moving ? move.clone() : new Vector3(Math.sin(this.visual.rotation.y), 0, Math.cos(this.visual.rotation.y));

    if (input.wasPressed("Space")) {
      if (this.grounded && !(opts.canClimb && this.tryMantle(facing, true))) {
        this.verticalVelocity = JUMP_VELOCITY;
        this.grounded = false;
      }
    }
    // Holding forward against a ledge while in the air grabs it.
    if (opts.canClimb && !this.grounded && moving && this.verticalVelocity < 2.5 && this.tryMantle(facing, false)) {
      this.animate(dt, 0);
      return horizontalDistance(start, this.collider.position);
    }

    this.verticalVelocity += GRAVITY * dt;
    if (!this.grounded && !opts.depleted) {
      if (opts.canHover && input.isDown("Space") && this.hoverRemaining > 0 && opts.spendEnergy?.(4 * dt)) {
        this.hoverRemaining = Math.max(0, this.hoverRemaining - dt); this.verticalVelocity = 0.8; this.isHovering = true;
      } else if (opts.canGlide && input.isDown("KeyF") && this.verticalVelocity < 0 && opts.spendEnergy?.(1.5 * dt)) {
        this.verticalVelocity = Math.max(-1.8, this.verticalVelocity); speed = 7; this.isGliding = true;
      }
    }
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
      this.hoverRemaining = 3;
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
    const solid = (m: AbstractMesh) => m.checkCollisions && m !== this.collider && m.isEnabled();
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
   * Body after the player-robot reference sheet: slim biped, about 1.6 m, a wide
   * binocular head on a thin neck, cream ceramic shell plates over graphite
   * structure and black rubber joints, folded solar wings on the back and small
   * cyan-white accent lights. Parts are merged per joint and material so the
   * whole robot costs about twenty draw calls.
   */
  private buildBody(scene: Scene): void {
    const shell = new StandardMaterial("robotShell", scene);
    shell.diffuseColor = Color3.FromHexString("#ddd5ca"); // mat-ceramic, matte
    shell.specularColor = new Color3(0.32, 0.31, 0.3);
    shell.specularPower = 24;
    const graphite = new StandardMaterial("robotGraphite", scene);
    graphite.diffuseColor = Color3.FromHexString("#55524f");
    graphite.specularColor = new Color3(0.35, 0.35, 0.35);
    graphite.specularPower = 48;
    const joint = new StandardMaterial("robotJoint", scene);
    joint.diffuseColor = Color3.FromHexString("#1d1d1f"); // flexible joints, rubber
    joint.specularColor = new Color3(0.12, 0.12, 0.12);
    const titanium = new StandardMaterial("robotTitanium", scene);
    titanium.diffuseColor = Color3.FromHexString("#8f887c");
    titanium.specularColor = new Color3(0.6, 0.58, 0.55);
    titanium.specularPower = 64;
    const solar = new StandardMaterial("robotSolar", scene);
    solar.diffuseColor = Color3.FromHexString("#3a3d62"); // iridescent solar surface
    solar.specularColor = new Color3(0.3, 0.28, 0.45);
    solar.specularPower = 96;
    const glass = new StandardMaterial("robotLensGlass", scene);
    glass.diffuseColor = Color3.FromHexString("#0b1418");
    glass.specularColor = new Color3(0.9, 0.95, 1);
    glass.specularPower = 128;
    glass.emissiveColor = new Color3(0.02, 0.07, 0.09);
    const glow = new StandardMaterial("robotGlow", scene);
    glow.emissiveColor = new Color3(0.55, 0.92, 1); // accent lights, cyan-white
    glow.disableLighting = true;

    // Parts are built in their joint's local space, then merged per joint + material.
    const groups = new Map<TransformNode, Map<StandardMaterial, Mesh[]>>();
    const part = (mesh: Mesh, mat: StandardMaterial, parent: TransformNode, x = 0, y = 0, z = 0) => {
      mesh.position.set(x, y, z);
      let byMat = groups.get(parent);
      if (!byMat) groups.set(parent, (byMat = new Map()));
      const list = byMat.get(mat) ?? [];
      list.push(mesh);
      byMat.set(mat, list);
      return mesh;
    };
    const node = (name: string, parent: TransformNode, x: number, y: number, z = 0) => {
      const n = new TransformNode(name, scene);
      n.parent = parent;
      n.position.set(x, y, z);
      return n;
    };
    const sphere = (d: number, segments = 8) => MeshBuilder.CreateSphere("robotPart", { diameter: d, segments }, scene);
    const capsule = (height: number, radius: number) =>
      MeshBuilder.CreateCapsule("robotPart", { height, radius, tessellation: 8, subdivisions: 1, capSubdivisions: 2 }, scene);
    const cylinder = (height: number, top: number, bottom = top, tessellation = 10) =>
      MeshBuilder.CreateCylinder("robotPart", { height, diameterTop: top, diameterBottom: bottom, tessellation }, scene);

    // --- Pelvis and torso -----------------------------------------------------
    this.pelvis = node("robotPelvis", this.visual, 0, 0.86);
    const hips = part(sphere(1, 10), shell, this.pelvis, 0, 0.0, 0.0);
    hips.scaling.set(0.27, 0.13, 0.18);
    part(cylinder(0.08, 0.2, 0.22), joint, this.pelvis, 0, -0.05);
    // Exposed graphite spine and abdomen.
    part(cylinder(0.26, 0.1, 0.12, 8), graphite, this.pelvis, 0, 0.17, -0.01);
    for (let i = 0; i < 3; i++) part(cylinder(0.025, 0.14 - i * 0.008, 0.14 - i * 0.008, 10), joint, this.pelvis, 0, 0.1 + i * 0.06, -0.005);
    // Chest: a shield-shaped ceramic shell, wide at the shoulders.
    const chest = part(sphere(1, 12), shell, this.pelvis, 0, 0.45, 0.01);
    chest.scaling.set(0.33, 0.34, 0.21);
    const ribs = part(cylinder(0.16, 0.26, 0.15, 12), shell, this.pelvis, 0, 0.3, 0.0);
    ribs.scaling.z = 0.62;
    const yoke = part(capsule(0.44, 0.05), shell, this.pelvis, 0, 0.56, -0.01);
    yoke.rotation.z = Math.PI / 2;
    const sternum = part(MeshBuilder.CreateBox("robotPart", { width: 0.1, height: 0.22, depth: 0.04 }, scene), graphite, this.pelvis, 0, 0.36, 0.105);
    sternum.rotation.x = -0.18;
    part(MeshBuilder.CreateBox("robotPart", { width: 0.018, height: 0.15, depth: 0.012 }, scene), glow, this.pelvis, 0, 0.37, 0.13).rotation.x = -0.18;
    // Collar the neck rises from.
    part(cylinder(0.06, 0.12, 0.17), graphite, this.pelvis, 0, 0.6, 0.02);
    // Folded solar wings on the back.
    for (const side of [-1, 1]) {
      const wing = part(MeshBuilder.CreateBox("robotPart", { width: 0.13, height: 0.32, depth: 0.02 }, scene), solar, this.pelvis, side * 0.1, 0.44, -0.14);
      wing.rotation.set(0.12, side * 0.3, side * 0.12);
      const frame = part(MeshBuilder.CreateBox("robotPart", { width: 0.02, height: 0.36, depth: 0.03 }, scene), titanium, this.pelvis, side * 0.18, 0.44, -0.11);
      frame.rotation.set(0.12, side * 0.3, side * 0.12);
    }

    // --- Neck and head ------------------------------------------------------------
    // The neck leans forward so the head sits slightly ahead of the chest.
    const neck = part(cylinder(0.22, 0.045, 0.06, 8), joint, this.pelvis, 0, 0.72, 0.04);
    neck.rotation.x = 0.25;
    part(cylinder(0.05, 0.075, 0.075, 8), graphite, this.pelvis, 0, 0.76, 0.05);
    this.head = node("robotHead", this.pelvis, 0, 0.88, 0.08);
    // Wide, flattened pill lying sideways.
    const skull = part(capsule(0.48, 0.12), shell, this.head, 0, 0.01, -0.02);
    skull.rotation.z = Math.PI / 2;
    skull.scaling.set(0.85, 1, 1.3);
    // Dark band where the shell halves meet, and the visor recess around the lenses.
    const band = part(capsule(0.5, 0.105), graphite, this.head, 0, -0.035, -0.02);
    band.rotation.z = Math.PI / 2;
    band.scaling.set(0.55, 1, 1.32);
    part(MeshBuilder.CreateBox("robotPart", { width: 0.3, height: 0.12, depth: 0.06 }, scene), joint, this.head, 0, -0.012, 0.11);
    // Twin lens barrels: dark rim, titanium ring, deep glass, cyan iris.
    for (const x of [-0.085, 0.085]) {
      const barrel = part(cylinder(0.08, 0.15, 0.16, 18), joint, this.head, x, -0.012, 0.15);
      barrel.rotation.x = Math.PI / 2;
      const ring = part(MeshBuilder.CreateTorus("robotPart", { diameter: 0.135, thickness: 0.018, tessellation: 14 }, scene), titanium, this.head, x, -0.012, 0.19);
      ring.rotation.x = Math.PI / 2;
      const lens = part(sphere(0.12, 8), glass, this.head, x, -0.012, 0.17);
      lens.scaling.z = 0.45;
      const iris = part(cylinder(0.006, 0.035, 0.035, 12), glow, this.head, x, -0.012, 0.198);
      iris.rotation.x = Math.PI / 2;
    }
    // Secondary sensor pods on the sides and a small one on top.
    for (const side of [-1, 1]) {
      const pod = part(cylinder(0.05, 0.06, 0.06, 10), joint, this.head, side * 0.25, -0.02, 0.06);
      pod.rotation.z = Math.PI / 2;
      part(sphere(0.022, 6), glow, this.head, side * 0.278, -0.02, 0.06);
    }
    part(cylinder(0.025, 0.05, 0.06, 8), graphite, this.head, 0, 0.115, -0.02);

    // --- Arms: long and thin, hands reach the knees -------------------------------------
    for (const side of [-1, 1]) {
      const shoulder = node("robotShoulder", this.pelvis, side * 0.22, 0.56);
      const cap = part(sphere(1, 10), shell, shoulder, side * 0.01, 0.01, 0);
      cap.scaling.set(0.13, 0.11, 0.13);
      part(sphere(0.075, 8), joint, shoulder);
      part(capsule(0.28, 0.042), shell, shoulder, 0, -0.17);
      part(cylinder(0.12, 0.035, 0.035, 6), graphite, shoulder, 0, -0.17, -0.03);
      const elbow = node("robotElbow", shoulder, 0, -0.32);
      part(sphere(0.07, 8), joint, elbow);
      part(sphere(0.018, 6), glow, elbow, side * 0.03, 0, 0.02);
      part(capsule(0.26, 0.036), shell, elbow, 0, -0.15, 0.005);
      part(cylinder(0.06, 0.05, 0.045, 8), joint, elbow, 0, -0.3);
      // Hand: dark palm, three long fingers and a thumb.
      part(MeshBuilder.CreateBox("robotPart", { width: 0.03, height: 0.07, depth: 0.06 }, scene), graphite, elbow, 0, -0.355, 0.01);
      for (const [fz, len] of [[-0.02, 0.11], [0.005, 0.12], [0.03, 0.105]] as const) {
        const finger = part(capsule(len, 0.009), joint, elbow, 0, -0.39 - len / 2 + 0.02, fz + 0.01);
        finger.rotation.x = 0.25 + fz * 2;
      }
      const thumb = part(capsule(0.07, 0.009), joint, elbow, -side * 0.02, -0.37, 0.045);
      thumb.rotation.set(0.7, 0, side * 0.3);
      this.arms.push({ shoulder, elbow });
    }

    // --- Legs: ceramic thigh and shin plates, adaptive split foot -------------------------
    for (const side of [-1, 1]) {
      const hip = node("robotHip", this.pelvis, side * 0.1, -0.06);
      part(sphere(0.09, 8), joint, hip);
      const thigh = part(capsule(0.36, 0.062), shell, hip, 0, -0.19, 0.01);
      thigh.scaling.z = 1.15;
      part(cylinder(0.28, 0.04, 0.04, 6), graphite, hip, side * 0.035, -0.2, -0.04);
      const knee = node("robotKnee", hip, 0, -0.4);
      part(sphere(0.085, 8), joint, knee);
      part(sphere(0.02, 6), glow, knee, 0, 0, 0.04);
      const kneeCap = part(sphere(1, 8), shell, knee, 0, 0.0, 0.035);
      kneeCap.scaling.set(0.07, 0.08, 0.05);
      const shin = part(cylinder(0.32, 0.1, 0.06, 10), shell, knee, 0, -0.19, 0.015);
      shin.scaling.z = 1.2;
      part(cylinder(0.3, 0.03, 0.03, 6), graphite, knee, 0, -0.2, -0.04);
      part(sphere(0.06, 8), joint, knee, 0, -0.36);
      // Two forward toes and a heel spur.
      for (const tx of [-0.028, 0.028]) {
        const toe = part(capsule(0.17, 0.022), graphite, knee, tx, -0.385, 0.07);
        toe.rotation.set(Math.PI / 2 - 0.08, tx * 2.5, 0);
        const tip = part(sphere(1, 6), shell, knee, tx * 1.2, -0.38, 0.12);
        tip.scaling.set(0.045, 0.035, 0.07);
      }
      const heel = part(capsule(0.09, 0.018), joint, knee, 0, -0.385, -0.04);
      heel.rotation.x = -Math.PI / 2 + 0.3;
      this.legs.push({ hip, knee });
    }

    for (const [parent, byMat] of groups) {
      for (const [mat, meshes] of byMat) {
        const merged = meshes.length === 1 ? meshes[0] : Mesh.MergeMeshes(meshes, true, true);
        if (!merged) continue;
        merged.name = `robot:${parent.name}:${mat.name}`;
        merged.material = mat;
        merged.parent = parent;
        merged.isPickable = false;
        this.bodyMeshes.push(merged);
      }
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
