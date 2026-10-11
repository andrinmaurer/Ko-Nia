import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "../babylon";
import { card } from "./textures";

const USE_RANGE = 3.5;
const ON = new Color3(0.35, 0.85, 1);
const OFF = new Color3(0.08, 0.2, 0.25);

/** Save / respawn / recharge hub. The robot boots up next to the first one. */
export class RelayStation {
  activated = false;

  constructor(
    readonly id: string,
    private readonly mesh: Mesh,
    readonly spawn: Vector3,
    readonly spawnYaw: number,
    /** The station's own light material, so each one shows its own state. */
    private readonly glow: StandardMaterial | null,
  ) {
    this.setActivated(false);
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  inRange(p: Vector3): boolean {
    return Math.abs(p.y - this.mesh.position.y + 3) < 3 && Math.hypot(p.x - this.mesh.position.x, p.z - this.mesh.position.z) < USE_RANGE;
  }

  setActivated(active: boolean): void {
    this.activated = active;
    this.glow?.emissiveColor.copyFrom(active ? ON : OFF);
  }
}

export interface RelayMaterials {
  concrete: StandardMaterial;
  metal: StandardMaterial;
  rust: StandardMaterial;
  solar: StandardMaterial;
  alien: StandardMaterial;
  glow: StandardMaterial;
}

type SolidFn = (mesh: Mesh, material: StandardMaterial, castShadow?: boolean) => Mesh;

/**
 * Relay Station after the reference sheet: a stepped octagonal base with railings, steps and an
 * interaction console; a weathered column framed by struts around a tall glowing data core; a ring of
 * twelve tilted solar panels; and a tall antenna array with dishes on top (about 8 m), overgrown with vines.
 * The front (console, core window) faces -z. Returns the column, which is the station's scannable/position mesh.
 */
export function buildRelayModel(scene: Scene, solid: SolidFn, mat: RelayMaterials, x: number, z: number, y = 0): Mesh {
  // Decorative parts are gathered per material and merged at the end: a few draw calls, not dozens.
  const buckets = new Map<string, { material: StandardMaterial; cast: boolean; meshes: Mesh[] }>();
  const deco = (mesh: Mesh, material: StandardMaterial, cast = true) => {
    const key = `${material.name}|${cast}`;
    const bucket = buckets.get(key) ?? { material, cast, meshes: [] };
    bucket.meshes.push(mesh);
    buckets.set(key, bucket);
    return mesh;
  };
  const lit = (mesh: Mesh) => { mesh.material = mat.glow; mesh.isPickable = false; return mesh; };
  // Stepped base, low enough to walk over.
  for (const [r, h] of [[2.2, 0.08], [1.6, 0.2]] as const) {
    const step = MeshBuilder.CreateCylinder("relayStep", { diameter: r * 2, height: 0.16, tessellation: 8 }, scene);
    step.position.set(x, y + h, z);
    step.rotation.y = Math.PI / 8;
    deco(step, mat.concrete, false);
  }
  // Railing posts and rails around the upper step, open at the front.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(Math.sin(a) + 1) < 0.5) continue; // gap facing -z
    const px = x + Math.cos(a) * 1.5, pz = z + Math.sin(a) * 1.5;
    const post = MeshBuilder.CreateCylinder("relayRailPost", { diameter: 0.05, height: 0.7, tessellation: 5 }, scene);
    post.position.set(px, y + 0.63, pz);
    deco(post, mat.rust, false);
    const b = a + Math.PI / 4, qx = x + Math.cos(b) * 1.5, qz = z + Math.sin(b) * 1.5;
    if (Math.abs(Math.sin(b) + 1) < 0.5) continue;
    const rail = MeshBuilder.CreateCylinder("relayRail", { diameter: 0.04, height: Math.hypot(qx - px, qz - pz), tessellation: 5 }, scene);
    rail.position.set((px + qx) / 2, y + 0.95, (pz + qz) / 2);
    rail.rotation.set(Math.PI / 2, -Math.atan2(qz - pz, qx - px) + Math.PI / 2, 0);
    deco(rail, mat.rust, false);
  }
  const pillar = MeshBuilder.CreateCylinder("relayStation", { diameterTop: 0.62, diameterBottom: 1.15, height: 6, tessellation: 8 }, scene);
  pillar.position.set(x, y + 3, z);
  solid(pillar, mat.concrete);
  // Four framing struts and banded collars around the column.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = MeshBuilder.CreateBox("relayStrut", { width: 0.14, height: 5.6, depth: 0.14 }, scene);
    strut.position.set(x + Math.cos(a) * 0.58, y + 2.9, z + Math.sin(a) * 0.58);
    strut.rotation.set(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05);
    deco(strut, mat.metal);
  }
  for (const [h, d] of [[0.5, 1.25], [3.6, 0.95], [5.6, 0.75]] as const) {
    const collar = MeshBuilder.CreateCylinder("relayCollar", { diameter: d, height: 0.18, tessellation: 8 }, scene);
    collar.position.set(x, y + h, z);
    deco(collar, mat.rust);
  }
  // Data core: tall glowing capsule behind a vertical window in the street side, framed in dark metal.
  const frame = MeshBuilder.CreateBox("relayCoreFrame", { width: 0.5, height: 2.9, depth: 0.12 }, scene);
  frame.position.set(x, y + 2.05, z - 0.42);
  frame.rotation.x = -0.06;
  deco(frame, mat.alien);
  const core = lit(MeshBuilder.CreateCylinder("relayCore", { diameter: 0.3, height: 2.6, tessellation: 12 }, scene));
  core.position.set(x, y + 2.05, z - 0.5);
  core.rotation.x = -0.06;
  // Interaction console in front of the steps: angled desk with a lit screen.
  const desk = MeshBuilder.CreateBox("relayConsole", { width: 0.9, height: 0.9, depth: 0.4 }, scene);
  desk.position.set(x, y + 0.65, z - 1.25);
  deco(desk, mat.metal);
  const screen = lit(MeshBuilder.CreatePlane("relayScreen", { width: 0.7, height: 0.32 }, scene));
  screen.position.set(x, y + 1.12, z - 1.36);
  screen.rotation.x = 0.7;
  // Solar panel ring: twelve framed panels tilted outwards like petals.
  const hub = MeshBuilder.CreateCylinder("relayHub", { diameter: 1.4, height: 0.35, tessellation: 12 }, scene);
  hub.position.set(x, y + 4.7, z);
  deco(hub, mat.rust);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 1.55 + (i % 2) * 0.12;
    const panel = MeshBuilder.CreateBox("relayPanel", { width: 1.6, height: 0.05, depth: 0.78 }, scene);
    panel.position.set(x + Math.cos(a) * r, y + 4.78 + (i % 2) * 0.14 - 0.15, z + Math.sin(a) * r);
    panel.rotation.set(0, -a, -0.32);
    deco(panel, mat.solar);
    const arm = MeshBuilder.CreateBox("relayPanelArm", { width: 1.7, height: 0.06, depth: 0.06 }, scene);
    arm.position.set(x + Math.cos(a) * r * 0.95, y + 4.72 + (i % 2) * 0.14 - 0.17, z + Math.sin(a) * r * 0.95);
    arm.rotation.set(0, -a, -0.32);
    deco(arm, mat.rust, false);
  }
  // Antenna array: a tall mast, shorter masts, two dishes and radio boxes.
  for (const [dx, dz, h, d] of [[0, 0, 2.8, 0.09], [0.22, 0.12, 1.8, 0.06], [-0.2, -0.15, 2.1, 0.06], [0.1, -0.25, 1.4, 0.05], [-0.15, 0.22, 1.2, 0.05]] as const) {
    const mast = MeshBuilder.CreateCylinder("relayMast", { diameterTop: d * 0.5, diameterBottom: d, height: h, tessellation: 5 }, scene);
    mast.position.set(x + dx, y + 6 + h / 2, z + dz);
    deco(mast, mat.metal, false);
  }
  for (const [dx, h, a] of [[0.32, 6.9, -0.8], [-0.3, 7.3, 2.4]] as const) {
    const dish = MeshBuilder.CreateCylinder("relayDish", { diameterTop: 0.5, diameterBottom: 0.12, height: 0.12, tessellation: 12 }, scene);
    dish.position.set(x + dx, y + h, z);
    dish.rotation.set(0, a, Math.PI / 2 * Math.sign(dx));
    deco(dish, mat.metal, false);
  }
  for (const [dx, h] of [[0.18, 6.4], [-0.16, 6.75]] as const) {
    const box = MeshBuilder.CreateBox("relayRadio", { width: 0.16, height: 0.4, depth: 0.14 }, scene);
    box.position.set(x + dx, y + h, z - 0.08);
    deco(box, mat.alien, false);
  }
  // Vines hanging from the panel ring and climbing the column.
  const vine = card(scene, "vine");
  const vines: Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const strand = MeshBuilder.CreatePlane("relayVine", { width: 0.7, height: 2.6 }, scene);
    strand.position.set(x + Math.cos(a) * (i % 2 ? 2 : 0.62), y + (i % 2 ? 3.4 : 2.2), z + Math.sin(a) * (i % 2 ? 2 : 0.62));
    strand.rotation.y = -a + Math.PI / 2;
    strand.material = vine;
    vines.push(strand);
  }
  const vineMesh = Mesh.MergeMeshes(vines, true)!;
  vineMesh.name = "relayVine";
  vineMesh.isPickable = false;
  for (const { material, cast, meshes } of buckets.values()) {
    const merged = Mesh.MergeMeshes(meshes, true)!;
    merged.name = `relayDeco:${material.name}`;
    solid(merged, material, cast);
    merged.checkCollisions = false;
    merged.isPickable = false;
  }
  const ring = lit(MeshBuilder.CreateTorus("relayRing", { diameter: 1.4, thickness: 0.06, tessellation: 32 }, scene));
  ring.position.set(x, y + 3.4, z);
  scene.onBeforeRenderObservable.add(() => {
    if (!ring.isEnabled()) return;
    ring.rotation.y += 0.01;
    ring.rotation.x = Math.sin(performance.now() / 1500) * 0.3;
  });
  const tip = lit(MeshBuilder.CreateSphere("relayTip", { diameter: 0.2, segments: 8 }, scene));
  tip.position.set(x, y + 8.85, z);
  return pillar;
}
