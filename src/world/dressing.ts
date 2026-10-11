import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  Vector4,
} from "../babylon";
import { card, rng, surface } from "./textures";
import { worldUV } from "./uv";

/**
 * Placeholder set dressing for Shrine Street: utility poles and sagging wires,
 * shop signs, balconies, AC units, wrecked cars, debris and a lot of green.
 *
 * Nothing here is scannable. Meshes are merged per material at the end so the
 * whole layer costs a handful of draw calls.
 */
export function buildDressing(scene: Scene, shadows: ShadowGenerator): void {
  const r = rng(2147);
  const batches = new Map<string, { material: StandardMaterial; meshes: Mesh[]; cast: boolean; collide: boolean }>();

  /** Queues a mesh for merging. Collidable batches block the robot. */
  const put = (mesh: Mesh, material: StandardMaterial, opts: { cast?: boolean; collide?: boolean; tile?: number } = {}): Mesh => {
    if (opts.tile) worldUV(mesh, opts.tile);
    const key = `${material.name}|${opts.cast ?? false}|${opts.collide ?? false}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { material, meshes: [], cast: opts.cast ?? false, collide: opts.collide ?? false };
      batches.set(key, batch);
    }
    batch.meshes.push(mesh);
    return mesh;
  };

  const m = {
    concrete: surface(scene, "concrete"),
    rust: surface(scene, "rust"),
    wood: surface(scene, "wood"),
    rubble: surface(scene, "rubble"),
    leaves: surface(scene, "leaves"),
    bark: surface(scene, "bark"),
    roof: surface(scene, "roof"),
    grass: card(scene, "grassTuft"),
    vine: card(scene, "vine"),
    ivy: card(scene, "ivy"),
    sign: card(scene, "sign"),
    wire: flat(scene, "wire", 0.08, 0.08, 0.08),
    paint: flat(scene, "lanePaint", 0.72, 0.7, 0.62),
    glass: flat(scene, "carGlass", 0.2, 0.24, 0.25, 0.6),
    mushroom: flat(scene, "mushroomCap", 0.86, 0.55, 0.72),
    stalk: flat(scene, "mushroomStalk", 0.85, 0.82, 0.76),
    lantern: flat(scene, "lantern", 0.75, 0.22, 0.14),
    cloth: flat(scene, "noren", 0.2, 0.26, 0.36),
    water: scene.getMaterialByName("water") as StandardMaterial,
  };
  m.lantern.emissiveColor = new Color3(0.25, 0.06, 0.02);
  m.mushroom.emissiveColor = new Color3(0.12, 0.04, 0.1);

  buildPoles(scene, r, put, m);
  buildFacadeClutter(scene, r, put, m);
  buildStreetClutter(scene, r, put, m);
  buildGreenery(scene, r, put, m);
  buildGrass(scene, r, m.grass);

  for (const batch of batches.values()) {
    const merged = Mesh.MergeMeshes(batch.meshes, true, true);
    if (!merged) continue;
    merged.name = `dressing:${batch.material.name}`;
    merged.material = batch.material;
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.checkCollisions = batch.collide;
    if (batch.cast) shadows.addShadowCaster(merged);
    merged.freezeWorldMatrix();
    merged.doNotSyncBoundingInfo = true;
  }
}

type Put = (mesh: Mesh, material: StandardMaterial, opts?: { cast?: boolean; collide?: boolean; tile?: number }) => Mesh;
type Mats = Record<string, StandardMaterial>;

function flat(scene: Scene, name: string, r: number, g: number, b: number, spec = 0.05): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = new Color3(r, g, b);
  mat.specularColor = new Color3(spec, spec, spec);
  return mat;
}

/** Spots that must stay clear: doorways, the relay, the torii, the overpass, the lotus puddle. */
const KEEP_CLEAR: [number, number, number, number][] = [
  [11, 16, -6, 6], // noodle shop door
  [-15, -9, -2, 5], // relay station
  [42, 46, -6, 6], // torii
  [-7, -2, -6, 6], // overpass
  [4.5, 8.5, -6, -4], // alley passage
  [22, 28, -4, 1], // lotus puddle
  [29, 42, -6, 6], // Hookbill foraging ground: keep sight lines open
];

function clear(x: number, z: number): boolean {
  return !KEEP_CLEAR.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
}

// --- Utility poles and wires ----------------------------------------------------

function buildPoles(scene: Scene, r: () => number, put: Put, m: Mats): void {
  const tops: Record<string, Vector3[]> = { n: [], s: [] };
  for (const [side, z] of [["n", 4.4], ["s", -4.4]] as const) {
    for (let x = -50; x <= 54; x += 13) {
      const px = x + (side === "s" ? 6 : 0);
      if (!clear(px, z)) continue;
      const lean = (r() - 0.5) * 0.08;
      const pole = MeshBuilder.CreateCylinder("pole", { diameterTop: 0.22, diameterBottom: 0.3, height: 9, tessellation: 6 }, scene);
      pole.position.set(px, 4.5, z);
      pole.rotation.x = lean;
      put(pole, m.concrete, { cast: true, collide: true, tile: 2 });
      const bar = MeshBuilder.CreateBox("poleBar", { width: 0.12, height: 0.12, depth: 1.8 }, scene);
      bar.position.set(px, 8.4, z + Math.sin(lean) * 8.4);
      put(bar, m.wood, { cast: true });
      if (r() < 0.5) {
        const can = MeshBuilder.CreateCylinder("transformer", { diameter: 0.5, height: 0.8, tessellation: 8 }, scene);
        can.position.set(px + 0.3, 7.2, z + Math.sin(lean) * 7.2);
        put(can, m.rust, { cast: true });
      }
      tops[side].push(new Vector3(px, 8.4, z + Math.sin(lean) * 8.4));
    }
  }
  const wire = (a: Vector3, b: Vector3, sag: number) => {
    const path: Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = Vector3.Lerp(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      path.push(p);
    }
    put(MeshBuilder.CreateTube("wire", { path, radius: 0.018, tessellation: 3 }, scene), m.wire);
  };
  for (const side of ["n", "s"]) {
    const list = tops[side];
    for (let i = 0; i + 1 < list.length; i++) {
      for (const dz of [-0.7, 0, 0.7]) {
        const a = list[i].add(new Vector3(0, 0.06, dz));
        const b = list[i + 1].add(new Vector3(0, 0.06, dz));
        if (r() < 0.12) {
          // Snapped wire hanging down towards the street.
          const end = a.add(new Vector3(2 + r() * 3, -5 - r() * 2, 0));
          wire(a, end, 0.4);
        } else {
          wire(a, b, 0.6 + r() * 0.5);
        }
      }
    }
  }
  // A few wires crossing the street.
  for (let i = 0; i < Math.min(tops.n.length, tops.s.length); i += 2) wire(tops.n[i], tops.s[i], 1.4);
}

// --- Signs, balconies, AC units, lanterns -------------------------------------------

/** Street-facing building fronts: x0, x1, wall z, height. */
const FRONTS: [number, number, number, number][] = [
  [-60, -35, 5, 12],
  [-35, -10, 5, 15],
  [-10, 6, 5, 6],
  [22, 40, 5, 9],
  [40, 60, 5, 8],
  [-60, -35, -5, 8],
  [-35, -12, -5, 7],
  [-12, 5, -5, 11],
  [8, 22, -5, 6],
  [22, 40, -5, 13],
  [40, 60, -5, 8],
];

function buildFacadeClutter(scene: Scene, r: () => number, put: Put, m: Mats): void {
  for (const [x0, x1, z, h] of FRONTS) {
    const out = z > 0 ? -1 : 1;
    // Vertical blade signs sticking out from the wall.
    for (let x = x0 + 2 + r() * 3; x < x1 - 1.5; x += 5 + r() * 6) {
      if (h < 7 || !clear(x, z)) continue;
      const col = Math.floor(r() * 4);
      const uv = new Vector4(col / 4, 0, (col + 1) / 4, 1);
      const height = 2 + r() * 1.6;
      const sign = MeshBuilder.CreateBox("sign", { width: 0.12, height, depth: 0.8, faceUV: [uv, uv, uv, uv, uv, uv] }, scene);
      sign.position.set(x, 4.2 + height / 2 + r() * 1.2, z + out * 0.55);
      sign.rotation.z = (r() - 0.5) * 0.12;
      put(sign, m.sign, { cast: true });
    }
    // Upper-floor balconies and AC units.
    for (let floor = 1; floor * 3.2 + 1 < h; floor++) {
      const y = floor * 3.2;
      for (let x = x0 + 1.5; x < x1 - 2; x += 4) {
        const roll = r();
        if (roll < 0.18 && clear(x, z) && !(x > -24 && x < -2 && z < 0)) {
          const slab = MeshBuilder.CreateBox("balcony", { width: 3, height: 0.15, depth: 1 }, scene);
          slab.position.set(x + 1.5, y, z + out * 0.5);
          put(slab, m.concrete, { cast: true, tile: 2 });
          const rail = MeshBuilder.CreateBox("rail", { width: 3, height: 0.9, depth: 0.05 }, scene);
          rail.position.set(x + 1.5, y + 0.5, z + out * 1);
          rail.rotation.x = (r() - 0.5) * 0.25;
          put(rail, m.rust, { cast: true, tile: 1.5 });
        } else if (roll < 0.45) {
          const ac = MeshBuilder.CreateBox("ac", { width: 0.8, height: 0.6, depth: 0.4 }, scene);
          ac.position.set(x + r() * 2, y + 0.4 + r() * 1.2, z + out * 0.2);
          put(ac, m.rust, { tile: 1 });
        }
      }
    }
  }
  // Rooftop water tanks and sheds.
  for (const [x, z, y] of [[-48, 15, 12], [-22, 12, 15], [-15, 20, 15], [30, 15, 9], [-3, -12, 11], [30, -12, 13]] as const) {
    const tank = MeshBuilder.CreateCylinder("tank", { diameter: 2, height: 2.2, tessellation: 10 }, scene);
    tank.position.set(x, y + 1.1, z);
    put(tank, m.rust, { cast: true });
    const shed = MeshBuilder.CreateBox("shed", { width: 3, height: 2.4, depth: 2.5 }, scene);
    shed.position.set(x + 3, y + 1.2, z + 1);
    put(shed, m.concrete, { cast: true, tile: 3 });
  }
  // Noodle shop: shop sign over the door, noren curtain and red lanterns.
  const board = MeshBuilder.CreateBox("shopSign", { width: 6, height: 0.9, depth: 0.12, faceUV: Array(6).fill(new Vector4(0, 0.6, 1, 0.9)) }, scene);
  board.position.set(13.5, 3.4, 4.8);
  put(board, m.sign, { cast: true });
  for (let i = 0; i < 3; i++) {
    const cloth = MeshBuilder.CreatePlane("noren", { width: 0.95, height: 0.7 }, scene);
    cloth.position.set(12.5 + i, 2.25, 4.78);
    cloth.rotation.y = Math.PI;
    cloth.rotation.x = 0.1 + r() * 0.15;
    put(cloth, m.cloth);
  }
  for (const [x, y, z] of [[11.6, 2.6, 4.5], [15.4, 2.6, 4.5], [46.5, 2.4, -2.2], [46.5, 2.4, 2.2], [52, 3.4, -2.6], [56, 3.4, -2.6]] as const) {
    const lantern = MeshBuilder.CreateSphere("lantern", { diameter: 0.45, segments: 6 }, scene);
    lantern.scaling.y = 1.35;
    lantern.position.set(x, y, z);
    put(lantern, m.lantern);
  }
}

// --- Cars, debris, puddles, lane paint ------------------------------------------------

function buildStreetClutter(scene: Scene, r: () => number, put: Put, m: Mats): void {
  const car = (x: number, z: number, yaw: number, tilt: number) => {
    const parts: Mesh[] = [];
    const body = MeshBuilder.CreateBox("carBody", { width: 4.2, height: 0.8, depth: 1.8 }, scene);
    body.position.y = 0.6;
    parts.push(put(body, m.rust, { cast: true, collide: true }));
    const cabin = MeshBuilder.CreateBox("carCabin", { width: 2.2, height: 0.7, depth: 1.6 }, scene);
    cabin.position.set(-0.2, 1.35, 0);
    parts.push(put(cabin, m.glass, { cast: true }));
    for (const [wx, wz] of [[-1.3, -0.85], [-1.3, 0.85], [1.3, -0.85], [1.3, 0.85]]) {
      const wheel = MeshBuilder.CreateCylinder("carWheel", { diameter: 0.6, height: 0.25, tessellation: 8 }, scene);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.22, wz);
      parts.push(put(wheel, m.wire));
    }
    const moss = MeshBuilder.CreateSphere("carMoss", { diameter: 1.4, segments: 4 }, scene);
    moss.scaling.set(1.4, 0.35, 1);
    moss.position.set(1.1, 1.05, 0.2);
    parts.push(put(moss, m.leaves, { cast: true }));
    const root = Matrix.Compose(Vector3.One(), Quaternion.FromEulerAngles(tilt, yaw, 0), new Vector3(x, 0, z));
    for (const p of parts) p.bakeTransformIntoVertices(p.computeWorldMatrix(true).multiply(root)).position.setAll(0);
    for (const p of parts) p.rotation.setAll(0);
  };
  car(-33, 1.6, 0.25, 0.03);
  car(-46, -1.8, -0.4, -0.04);
  car(18.5, -2.4, 2.9, 0.02);

  // Debris heaps along the walls.
  for (let i = 0; i < 26; i++) {
    const x = -55 + r() * 110;
    const z = (r() < 0.5 ? 1 : -1) * (4.3 + r() * 0.5);
    if (!clear(x, z)) continue;
    for (let k = 0; k < 4; k++) {
      const size = 0.25 + r() * 0.6;
      const rock = MeshBuilder.CreateBox("debris", { width: size * (1 + r()), height: size * 0.6, depth: size }, scene);
      rock.position.set(x + (r() - 0.5) * 1.5, size * 0.25, z + (r() - 0.5) * 0.8);
      rock.rotation.set(r() * 0.5, r() * 3, r() * 0.5);
      put(rock, m.rubble, { tile: 1 });
    }
  }
  // Rain puddles.
  for (let i = 0; i < 14; i++) {
    const x = -55 + r() * 100;
    const z = (r() - 0.5) * 6;
    if (!clear(x, z)) continue;
    const puddle = MeshBuilder.CreateDisc("puddle", { radius: 0.6 + r() * 1.4, tessellation: 12 }, scene);
    puddle.rotation.x = Math.PI / 2;
    puddle.scaling.set(1 + r(), 0.6 + r() * 0.5, 1);
    puddle.position.set(x, 0.022, z);
    put(puddle, m.water);
  }
  // Faded dashed centre line, with gaps where the asphalt broke up.
  for (let x = -56; x < 42; x += 6) {
    if (r() < 0.25 || !clear(x + 1.5, 0)) continue;
    const dash = MeshBuilder.CreateGround("laneDash", { width: 3, height: 0.18 }, scene);
    dash.position.set(x + 1.5, 0.02, 0);
    put(dash, m.paint);
  }
}

// --- Trees, bushes, vines, ivy, mushrooms --------------------------------------------

function buildGreenery(scene: Scene, r: () => number, put: Put, m: Mats): void {
  // Bushes and fern clumps at the foot of the walls.
  for (let i = 0; i < 60; i++) {
    const x = -57 + r() * 114;
    const z = (r() < 0.5 ? 1 : -1) * (4.5 + r() * 0.4);
    if (!clear(x, z)) continue;
    const bush = MeshBuilder.CreateSphere("bush", { diameter: 1, segments: 4 }, scene);
    const s = 0.6 + r() * 1.2;
    bush.scaling.set(s * (1 + r()), s * 0.7, s);
    bush.position.set(x, s * 0.2, z);
    put(bush, m.leaves, { cast: true });
  }
  // Rooftop saplings.
  for (const [x, z, y] of [[-55, 20, 12], [-28, 8, 15], [0, 12, 6], [37, 8, 9], [55, 12, 8], [-50, -10, 8], [16, -14, 6], [48, -12, 8]] as const) {
    tree(scene, r, put, m, x, y, z, 2.5 + r() * 2);
  }
  // Alley tree.
  tree(scene, r, put, m, -16, 0, -23.5, 7);

  // Hanging vines from roof edges and the overpass.
  const hang = (x: number, y: number, z: number, len: number, facing: number) => {
    const p = MeshBuilder.CreatePlane("vine", { width: 1.6 + r() * 1.5, height: len }, scene);
    p.position.set(x, y - len / 2, z);
    p.rotation.y = facing;
    put(p, m.vine);
  };
  for (const [x0, x1, z, h] of FRONTS) {
    const out = z > 0 ? -1 : 1;
    for (let x = x0 + 1; x < x1 - 1; x += 1.5 + r() * 4) {
      if (r() < 0.45) hang(x, h + 0.2, z + out * 0.06, 2 + r() * Math.min(h - 1, 7), z > 0 ? Math.PI : 0);
    }
  }
  for (let z = -3.3; z < 4.8; z += 0.9) {
    if (r() < 0.6) hang(-6.05, 6, z, 1.5 + r() * 3, Math.PI / 2);
    if (r() < 0.6) hang(-2.95, 6, z, 1.5 + r() * 3, -Math.PI / 2);
  }
  // Ivy patches climbing the walls.
  for (const [x0, x1, z, h] of FRONTS) {
    const out = z > 0 ? -1 : 1;
    for (let x = x0 + 1; x < x1; x += 3 + r() * 5) {
      const size = 2 + r() * 3.5;
      const p = MeshBuilder.CreatePlane("ivyPatch", { size }, scene);
      p.position.set(x, Math.min(r() * h * 0.7, h - size / 2) + size * 0.3, z + out * 0.08);
      p.rotation.y = z > 0 ? Math.PI : 0;
      put(p, m.ivy);
    }
  }
  // Pink mushroom clusters (shrine, alley, noodle shop back room).
  for (const [cx, cz] of [[49, -3.8], [57, 3], [51, 4], [-26, -24], [3, -24.5], [19, 18.5], [8, 16.5]] as const) {
    for (let k = 0; k < 4; k++) {
      const h = 0.25 + r() * 0.5;
      const x = cx + (r() - 0.5) * 1.2;
      const z = cz + (r() - 0.5) * 1.2;
      const stalk = MeshBuilder.CreateCylinder("mushStalk", { diameter: 0.07 + h * 0.08, height: h, tessellation: 5 }, scene);
      stalk.position.set(x, h / 2, z);
      put(stalk, m.stalk);
      const cap = MeshBuilder.CreateSphere("mushCap", { diameter: 0.3 + h * 0.6, segments: 5, slice: 0.5 }, scene);
      cap.scaling.y = 0.6;
      cap.position.set(x, h, z);
      put(cap, m.mushroom);
    }
  }
}

function tree(scene: Scene, r: () => number, put: Put, m: Mats, x: number, y: number, z: number, height: number): void {
  const trunk = MeshBuilder.CreateCylinder("treeTrunk", { diameterTop: height * 0.05, diameterBottom: height * 0.1, height, tessellation: 6 }, scene);
  trunk.position.set(x, y + height / 2, z);
  trunk.rotation.z = (r() - 0.5) * 0.3;
  put(trunk, m.bark, { cast: true });
  for (let k = 0; k < 5; k++) {
    const s = height * (0.35 + r() * 0.25);
    const blob = MeshBuilder.CreateSphere("treeCanopy", { diameter: s, segments: 5 }, scene);
    blob.scaling.y = 0.7;
    blob.position.set(x + (r() - 0.5) * height * 0.4, y + height * (0.8 + r() * 0.3), z + (r() - 0.5) * height * 0.4);
    put(blob, m.leaves, { cast: true });
  }
}

// --- Grass tufts (thin instances) -------------------------------------------------------

function buildGrass(scene: Scene, r: () => number, material: StandardMaterial): void {
  const a = MeshBuilder.CreatePlane("tuftA", { width: 0.8, height: 0.55 }, scene);
  const b = MeshBuilder.CreatePlane("tuftB", { width: 0.8, height: 0.55 }, scene);
  b.rotation.y = Math.PI / 2;
  b.bakeCurrentTransformIntoVertices();
  const tuft = Mesh.MergeMeshes([a, b], true)!;
  tuft.name = "grassTufts";
  tuft.bakeTransformIntoVertices(Matrix.Translation(0, 0.27, 0));
  tuft.material = material;
  tuft.isPickable = false;
  tuft.receiveShadows = true;

  const matrices: number[] = [];
  const add = (x: number, z: number, scale: number, y = 0) => {
    const mtx = Matrix.Compose(new Vector3(scale, scale * (0.7 + r() * 0.6), scale), Quaternion.FromEulerAngles(0, r() * Math.PI, 0), new Vector3(x, y, z));
    matrices.push(...mtx.asArray());
  };
  // Along the kerbs and wall bases.
  for (let i = 0; i < 700; i++) {
    const x = -58 + r() * 116;
    const z = (r() < 0.5 ? 1 : -1) * (3.3 + r() * 1.6);
    if (clear(x, z) || r() < 0.3) add(x, z, 0.6 + r() * 0.8);
  }
  // Through cracks in the asphalt.
  for (let i = 0; i < 260; i++) {
    const x = -58 + r() * 116;
    const z = (r() - 0.5) * 6.5;
    if (clear(x, z)) add(x, z, 0.4 + r() * 0.6);
  }
  // The alley, the shrine grounds and the rubble at the west end.
  for (let i = 0; i < 360; i++) add(-34 + r() * 72, -20.5 - r() * 5, 0.6 + r() * 0.9);
  for (let i = 0; i < 200; i++) add(45 + r() * 14, (r() - 0.5) * 18, 0.6 + r() * 0.9);
  for (let i = 0; i < 80; i++) add(-58 + r() * 4, (r() - 0.5) * 10, 0.7 + r() * 0.8, 1 + r() * 2);

  tuft.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, true);
  tuft.thinInstanceRefreshBoundingInfo();
  tuft.freezeWorldMatrix();
}
