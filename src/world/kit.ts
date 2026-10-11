import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, Scene, ShadowGenerator, StandardMaterial, Vector3 } from "../babylon";
import { card, surface, type Card, type Surface } from "./textures";
import { worldUV } from "./uv";

/**
 * Building kit for authored blocks after Shrine Street: textured boxes and
 * props that are merged per material and per 40 m cell when the block is
 * done, so a whole block costs a few dozen draw calls and collision tests stay
 * local. Meshes that must stay separate (scannable objects) pass `keep`.
 */
export interface PieceOptions {
  /** Casts a shadow (default true). */
  cast?: boolean;
  /** Blocks the robot (default true). */
  collide?: boolean;
  /** Keep as its own mesh instead of merging (scannables, animated parts). */
  keep?: boolean;
  /** Metres per texture repeat; defaults to the material's registered tile size. */
  tile?: number;
  /** Invisible collider (the visible shape is built separately). */
  hidden?: boolean;
}

const CELL = 40;

export class Kit {
  private readonly tiles = new Map<StandardMaterial, [number, number]>();
  private readonly batches = new Map<string, { material: StandardMaterial; meshes: Mesh[]; cast: boolean; collide: boolean; hidden: boolean }>();

  constructor(
    readonly scene: Scene,
    private readonly shadows: ShadowGenerator,
  ) {}

  /** Shared tiling surface material; `u`/`v` are metres per repeat. */
  tex(kind: Surface, u: number, v = u): StandardMaterial {
    const m = surface(this.scene, kind);
    if (!this.tiles.has(m)) this.tiles.set(m, [u, v]);
    return m;
  }

  card(kind: Card): StandardMaterial {
    return card(this.scene, kind);
  }

  /** Untextured material, shared by name. */
  flat(name: string, r: number, g: number, b: number, spec = 0.05): StandardMaterial {
    const existing = this.scene.getMaterialByName(name);
    if (existing instanceof StandardMaterial) return existing;
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = new Color3(r, g, b);
    m.specularColor = new Color3(spec, spec, spec);
    return m;
  }

  /** Adds a positioned mesh to the block. */
  add(mesh: Mesh, material: StandardMaterial, opts: PieceOptions = {}): Mesh {
    const cast = opts.cast ?? true;
    const collide = opts.collide ?? true;
    const tile = opts.tile !== undefined ? ([opts.tile, opts.tile] as [number, number]) : this.tiles.get(material);
    if (tile) {
      mesh.computeWorldMatrix(true);
      if (mesh.rotationQuaternion || !mesh.rotation.equalsToFloats(0, 0, 0)) {
        // Box projection works in world space: bake rotation first.
        mesh.bakeCurrentTransformIntoVertices();
      }
      worldUV(mesh, tile[0], tile[1]);
    }
    mesh.material = material;
    mesh.receiveShadows = true;
    if (opts.keep) {
      mesh.checkCollisions = collide;
      if (cast) this.shadows.addShadowCaster(mesh);
      return mesh;
    }
    const hidden = opts.hidden ?? false;
    const c = mesh.getBoundingInfo().boundingBox.centerWorld;
    const key = `${material.name}|${cast}|${collide}|${hidden}|${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { material, meshes: [], cast: cast && !hidden, collide, hidden };
      this.batches.set(key, batch);
    }
    batch.meshes.push(mesh);
    return mesh;
  }

  /** Box spanning x0..x1, y0..y1, z0..z1. */
  box(name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: StandardMaterial, opts: PieceOptions = {}): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: x1 - x0, height: y1 - y0, depth: z1 - z0 }, this.scene);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mesh, material, opts);
  }

  /**
   * A sloped slab (stairs, fallen beams) whose top surface runs from `from` to `to`
   * (centre line), `width` wide. Returns the mesh.
   */
  slope(name: string, from: Vector3, to: Vector3, width: number, thickness: number, material: StandardMaterial, opts: PieceOptions = {}): Mesh {
    const d = to.subtract(from);
    const length = d.length();
    const mesh = MeshBuilder.CreateBox(name, { width: length, height: thickness, depth: width }, this.scene);
    const yaw = Math.atan2(-d.z, d.x);
    const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, yaw, pitch);
    const mid = from.add(to).scale(0.5);
    // Drop by half the thickness along the slab's normal so the top surface is on the line.
    const normal = Vector3.TransformNormal(Vector3.Up(), Matrix.FromQuaternionToRef(mesh.rotationQuaternion, new Matrix()));
    mesh.position.copyFrom(mid.subtract(normal.scale(thickness / 2)));
    return this.add(mesh, material, opts);
  }

  /** Merges everything queued. Call once when the block is built. */
  finish(): void {
    for (const batch of this.batches.values()) {
      const merged = Mesh.MergeMeshes(batch.meshes, true, true);
      if (!merged) continue;
      merged.name = `kit:${batch.material.name}`;
      merged.material = batch.material;
      merged.isPickable = batch.collide;
      merged.receiveShadows = true;
      merged.checkCollisions = batch.collide;
      merged.isVisible = !batch.hidden;
      if (batch.cast) this.shadows.addShadowCaster(merged);
      merged.freezeWorldMatrix();
    }
    this.batches.clear();
  }
}

/** Thin-instanced crossed-card plants (ferns, giant leaves, grass) at many spots. */
export function scatterCards(
  scene: Scene,
  name: string,
  material: StandardMaterial,
  width: number,
  height: number,
  planes: number,
  spots: { x: number; y: number; z: number; s: number }[],
  r: () => number,
): Mesh | undefined {
  if (spots.length === 0) return undefined;
  const parts: Mesh[] = [];
  for (let i = 0; i < planes; i++) {
    const p = MeshBuilder.CreatePlane(`${name}Card`, { width, height }, scene);
    p.rotation.y = (i / planes) * Math.PI;
    p.rotation.x = planes > 2 ? 0.18 : 0.12;
    p.bakeCurrentTransformIntoVertices();
    parts.push(p);
  }
  const mesh = Mesh.MergeMeshes(parts, true)!;
  mesh.name = name;
  mesh.bakeTransformIntoVertices(Matrix.Translation(0, height / 2 - 0.05, 0));
  mesh.material = material;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  const buffer = new Float32Array(spots.length * 16);
  spots.forEach((p, i) =>
    Matrix.Compose(new Vector3(p.s, p.s * (0.8 + r() * 0.4), p.s), Quaternion.FromEulerAngles(0, r() * Math.PI * 2, 0), new Vector3(p.x, p.y, p.z)).copyToArray(buffer, i * 16),
  );
  mesh.thinInstanceSetBuffer("matrix", buffer, 16, true);
  mesh.thinInstanceRefreshBoundingInfo();
  mesh.freezeWorldMatrix();
  return mesh;
}

/**
 * Stone stairs from (x0, y0) up to (x1, y1) between z0 and z1 (x1 may be west of
 * x0): a hidden ramp the robot walks on, with visible steps on top of it.
 */
export function stairs(kit: Kit, scene: Scene, name: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: StandardMaterial): void {
  const ramp = MeshBuilder.CreateBox(`${name}Ramp`, { width: Math.hypot(x1 - x0, y1 - y0), height: 0.2, depth: z1 - z0 }, scene);
  // Rising towards +x or -x; the ramp keeps its top face up either way.
  ramp.rotation.z = x1 >= x0 ? Math.atan2(y1 - y0, x1 - x0) : -Math.atan2(y1 - y0, x0 - x1);
  // The ramp's top surface runs along the steps' front edges.
  const a = ramp.rotation.z;
  ramp.position.set((x0 + x1) / 2 + 0.1 * Math.sin(a), (y0 + y1) / 2 - 0.1 * Math.cos(a), (z0 + z1) / 2);
  ramp.isVisible = false;
  ramp.isPickable = false;
  ramp.checkCollisions = true;
  const steps = Math.ceil((y1 - y0) / 0.32);
  const rise = (y1 - y0) / steps;
  const run = (x1 - x0) / steps;
  for (let i = 0; i < steps; i++) {
    const top = y0 + (i + 1) * rise;
    const a = x0 + i * run;
    const b = x0 + (i + 1) * run + Math.sign(run) * 0.05;
    kit.box(`${name}Step`, Math.min(a, b), Math.max(a, b), Math.max(y0 - 0.5, top - 1.2), top, z0, z1, material, { collide: false });
  }
}

export function stoneLantern(kit: Kit, scene: Scene, stone: StandardMaterial, light: StandardMaterial, x: number, y: number, z: number): void {
  kit.box("lanternBase", x - 0.35, x + 0.35, y, y + 0.25, z - 0.35, z + 0.35, stone, { collide: false });
  kit.box("lanternPost", x - 0.15, x + 0.15, y + 0.25, y + 1.05, z - 0.15, z + 0.15, stone, { collide: false });
  kit.box("lanternBox", x - 0.3, x + 0.3, y + 1.05, y + 1.5, z - 0.3, z + 0.3, light, { collide: false });
  const cap = MeshBuilder.CreateCylinder("lanternCap", { diameterTop: 0.1, diameterBottom: 0.95, height: 0.35, tessellation: 6 }, scene);
  cap.position.set(x, y + 1.67, z);
  kit.add(cap, stone, { collide: false, tile: 1 });
}

