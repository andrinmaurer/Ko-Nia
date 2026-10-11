import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "../babylon";

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
 * Relay Station after the reference sheet: stepped base, slim column with a glowing
 * data core, a ring of solar panels and an antenna array on top (about 6.5 m).
 * Returns the column, which is the station's scannable/position mesh.
 */
export function buildRelayModel(scene: Scene, solid: SolidFn, mat: RelayMaterials, x: number, z: number, y = 0): Mesh {
  const deco = (mesh: Mesh, material: StandardMaterial, cast = true) => {
    solid(mesh, material, cast);
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    return mesh;
  };
  // Stepped base, low enough to walk over.
  for (const [r, h] of [[2.2, 0.08], [1.6, 0.2]] as const) {
    const step = MeshBuilder.CreateCylinder("relayStep", { diameter: r * 2, height: 0.16, tessellation: 8 }, scene);
    step.position.set(x, y + h, z);
    deco(step, mat.concrete, false);
  }
  const pillar = MeshBuilder.CreateCylinder("relayStation", { diameterTop: 0.45, diameterBottom: 1.1, height: 6, tessellation: 8 }, scene);
  pillar.position.set(x, y + 3, z);
  solid(pillar, mat.alien);
  // Framing struts around the column.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = MeshBuilder.CreateBox("relayStrut", { width: 0.12, height: 5.2, depth: 0.12 }, scene);
    strut.position.set(x + Math.cos(a) * 0.55, y + 2.8, z + Math.sin(a) * 0.55);
    strut.rotation.set(Math.sin(a) * 0.06, 0, -Math.cos(a) * 0.06);
    deco(strut, mat.metal);
  }
  // Data core: glowing capsule behind the street-side window.
  const core = MeshBuilder.CreateCylinder("relayCore", { diameter: 0.5, height: 1.6, tessellation: 12 }, scene);
  core.position.set(x, y + 1.6, z - 0.32);
  core.material = mat.glow;
  core.isPickable = false;
  // Solar panel ring.
  const hub = MeshBuilder.CreateCylinder("relayHub", { diameter: 1.2, height: 0.3, tessellation: 8 }, scene);
  hub.position.set(x, y + 4.6, z);
  deco(hub, mat.rust);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const panel = MeshBuilder.CreateBox("relayPanel", { width: 1.9, height: 0.06, depth: 0.9 }, scene);
    panel.position.set(x + Math.cos(a) * 1.55, y + 4.75 + (i % 2) * 0.12, z + Math.sin(a) * 1.55);
    panel.rotation.set(0, -a, 0.22);
    deco(panel, mat.solar);
  }
  // Antenna array.
  for (const [dx, dz, h] of [[0, 0, 2.2], [0.25, 0.1, 1.4], [-0.2, -0.15, 1.7]] as const) {
    const mast = MeshBuilder.CreateCylinder("relayMast", { diameter: 0.06, height: h, tessellation: 4 }, scene);
    mast.position.set(x + dx, y + 6 + h / 2, z + dz);
    deco(mast, mat.metal, false);
  }
  const ring = MeshBuilder.CreateTorus("relayRing", { diameter: 1.4, thickness: 0.06, tessellation: 32 }, scene);
  ring.position.set(x, y + 3.4, z);
  ring.material = mat.glow;
  ring.isPickable = false;
  scene.onBeforeRenderObservable.add(() => {
    if (!ring.isEnabled()) return;
    ring.rotation.y += 0.01;
    ring.rotation.x = Math.sin(performance.now() / 1500) * 0.3;
  });
  const tip = MeshBuilder.CreateSphere("relayTip", { diameter: 0.22, segments: 8 }, scene);
  tip.position.set(x, y + 8.2, z);
  tip.material = mat.glow;
  tip.isPickable = false;
  return pillar;
}
