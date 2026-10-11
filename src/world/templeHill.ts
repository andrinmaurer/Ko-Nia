import { Color3, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, Vector3 } from "../babylon";
import { Kit, scatterCards, stairs, stoneLantern } from "./kit";
import { buildRelayModel } from "./relay";
import { card, paint, rng } from "./textures";
import { Form, organic, weatheredStone } from "./life/visuals";

/**
 * "Temple Hill", the second block (docs/blocks/02_TEMPLE_HILL_PROPOSAL.md):
 * the old temple complex above Shrine Street, reached by the stair lane.
 *
 * The temple stands on a plateau at y = 10. Axes as in Shrine Street (+x east,
 * +z north). The temple axis runs west → east along z = 6.75, from the gate
 * (x 114) across the courtyard to the main hall (x 180..200).
 */
export const GROUND = 10;
export const AXIS_Z = 6.75;

export const TEMPLE = {
  x0: 112,
  x1: 232,
  z0: -33,
  z1: 47,
  pond: { x0: 128, x1: 156, z0: -28, z1: -8, bed: 9.55, water: 9.85 },
  bridge: { x: 141.75, z0: -7.5, z1: -16.5 },
  hall: { x0: 180, x1: 200, z0: -9, z1: 23, floor: 11, wall: 19 },
  /** The dark north end of the hall, behind a screen wall with one doorway. */
  sanctum: { z: 10, door: { x0: 188, x1: 191.5 } },
  /** The open, roofless half of the hall where the cedar grows. */
  cedar: new Vector3(191, 11, -1.5),
  pagoda: { x: 164, z: 32 },
  gateRoof: new Vector3(117.5, 20.05, 1.5),
  offeringBox: new Vector3(179.45, 11, 2),
  antMound: new Vector3(161, GROUND, -7.5),
  fruitPile: new Vector3(171, GROUND, -22),
  bell: new Vector3(141, GROUND, 25),
  gallery: { x0: 197.4, x1: 199.6, z0: -1, z1: 21.5, y: 14.5 },
};

/** Gap in the east compound wall where the path to the Flooded Arcade leaves. */
export const BREACH = { z0: 9.5, z1: 14 };

/** Pagoda tiers: half-size of each tier body; eaves stick out 1.6 m further. */
export const PAGODA_TIERS = [4, 3.5, 3, 2.5, 2];
export const PAGODA_TIER_HEIGHT = 3.2;
/** Corner left open in each eave so the robot can climb through (sign of x, sign of z). */
const CLIMB_CORNERS: [number, number][] = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

export interface TempleHill {
  relayStation: Mesh;
  relayGlow: StandardMaterial;
  spawn: Vector3;
  spawnYaw: number;
  /** Separate meshes the discovery code makes scannable. */
  lanterns: Mesh[];
  bell: Mesh;
  offeringBox: Mesh;
  scrollShelf: Mesh;
  wishWall: Mesh;
  pagodaTop: Vector3;
}

export function buildTempleHill(scene: Scene, shadows: ShadowGenerator): TempleHill {
  const kit = new Kit(scene, shadows);
  const r = rng(5113);
  const m = {
    gravel: kit.tex("dirt", 5),
    moss: kit.tex("grass", 2),
    stone: kit.tex("stone", 2),
    paving: kit.tex("sidewalk", 3),
    rubble: kit.tex("rubble", 3),
    wood: kit.tex("wood", 3),
    plaster: kit.tex("plaster", 3),
    roof: kit.tex("roof", 5),
    concrete: kit.tex("concrete", 4),
    concreteDark: kit.tex("concreteDark", 4),
    facade: kit.tex("facadeDark", 8, 6.4),
    bark: kit.tex("bark", 2),
    leaves: kit.tex("leaves", 3),
    rust: kit.tex("rust", 2),
    solar: kit.tex("solar", 1.5),
    red: redWood(scene),
    bronze: kit.flat("templeBronze", 0.2, 0.27, 0.22, 0.35),
    floor: kit.tex("wood", 2.5),
    darkWood: darkWood(scene),
    metal: kit.flat("metal", 0.35, 0.37, 0.4, 0.3),
    alien: kit.flat("alien", 0.12, 0.13, 0.16, 0.6),
    // Fire boxes stand empty and dark (stone lantern photo).
    lanternLight: kit.flat("stoneLanternLight", 0.08, 0.07, 0.06),
    water: scene.getMaterialByName("water") as StandardMaterial,
    foliage: card(scene, "foliage"),
  };

  buildGround(kit, scene, m);
  buildWalls(kit, m);
  buildGate(kit, scene, m);
  const lanterns = buildCourtyard(kit, scene, m, r);
  const bell = buildBellTower(kit, scene, m);
  buildPond(kit, scene, m, r);
  const hall = buildHall(kit, scene, m);
  const pagodaTop = buildPagoda(kit, scene, m);
  buildSurroundings(scene, r, m);

  // Relay Station 2, just inside the gate on the south side of the path.
  const relayGlow = new StandardMaterial("glowTemple", scene);
  relayGlow.emissiveColor = new Color3(0.35, 0.85, 1);
  relayGlow.disableLighting = true;
  const solid = (mesh: Mesh, material: StandardMaterial, cast = true) => kit.add(mesh, material, { cast, keep: true });
  const relayStation = buildRelayModel(scene, solid, { ...m, glow: relayGlow }, 130, -1.5, GROUND);

  kit.finish();
  buildPlants(scene, r);

  return {
    relayStation,
    relayGlow,
    spawn: new Vector3(130.5, GROUND + 0.2, 1.8),
    spawnYaw: Math.PI / 2,
    lanterns,
    bell,
    offeringBox: hall.offeringBox,
    scrollShelf: hall.scrollShelf,
    wishWall: hall.wishWall,
    pagodaTop,
  };
}

type Mats = Record<string, StandardMaterial>;

/** Timber stained dark by the years, for the hall's shadowy sanctum. */
function darkWood(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName("templeDarkWood");
  if (existing instanceof StandardMaterial) return existing;
  const m = new StandardMaterial("templeDarkWood", scene);
  m.diffuseColor = new Color3(0.42, 0.36, 0.32);
  m.specularColor = new Color3(0.03, 0.03, 0.03);
  const wood = scene.getMaterialByName("surface:wood") as StandardMaterial | null;
  if (wood) m.diffuseTexture = wood.diffuseTexture;
  return m;
}

function redWood(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName("templeRed");
  if (existing instanceof StandardMaterial) return existing;
  const red = new StandardMaterial("templeRed", scene);
  red.diffuseColor = new Color3(0.6, 0.24, 0.16);
  red.specularColor = new Color3(0.04, 0.04, 0.04);
  const wood = scene.getMaterialByName("surface:wood") as StandardMaterial | null;
  if (wood) red.diffuseTexture = wood.diffuseTexture;
  return red;
}

// --- Plateau, pond bed and the forest floor beyond the walls -----------------------

function buildGround(kit: Kit, scene: Scene, m: Mats): void {
  const { x0, x1, z0, z1, pond } = TEMPLE;
  // The hill under the temple, with a hole for the pond.
  kit.box("hillN", x0, x1, 0, GROUND, pond.z1, z1, m.gravel, { cast: false });
  kit.box("hillW", x0, pond.x0, 0, GROUND, z0, pond.z1, m.gravel, { cast: false });
  kit.box("hillE", pond.x1, x1, 0, GROUND, z0, pond.z1, m.gravel, { cast: false });
  kit.box("hillS", pond.x0, pond.x1, 0, GROUND, z0, pond.z0, m.gravel, { cast: false });
  kit.box("pondBed", pond.x0, pond.x1, 0, pond.bed, pond.z0, pond.z1, m.gravel, { cast: false });
  // Moss creeping over the gravel.
  const r = rng(91);
  for (let i = 0; i < 26; i++) {
    const x = 122 + r() * 100;
    const z = -30 + r() * 74;
    if (x > pond.x0 - 2 && x < pond.x1 + 2 && z > pond.z0 - 2 && z < pond.z1 + 2) continue;
    if (x > 176 && x < 202 && z > -11 && z < 25) continue;
    const w = 4 + r() * 9;
    const d = 3 + r() * 7;
    kit.box("mossPatch", x - w / 2, x + w / 2, GROUND, GROUND + 0.012 + i * 0.0004, z - d / 2, z + d / 2, m.moss, { cast: false, collide: false });
  }
  // Paved path along the temple axis.
  kit.box("axisPath", 121, 177, GROUND, GROUND + 0.04, AXIS_Z - 1.6, AXIS_Z + 1.6, m.paving, { cast: false, collide: false });
  // Forest floor outside the walls, so nothing below the horizon is empty.
  const outside = MeshBuilder.CreateGround("forestFloor", { width: 600, height: 600 }, scene);
  outside.position.set(x0 + 300, GROUND - 0.5, 7);
  kit.add(outside, m.leaves, { cast: false, collide: false, keep: true, tile: 6 });
  outside.isPickable = false;
}

// --- Compound walls: plastered, tile-capped, too tall to climb ----------------------

function buildWalls(kit: Kit, m: Mats): void {
  const { x0, x1, z0, z1 } = TEMPLE;
  const top = GROUND + 5;
  const wall = (name: string, ax: number, bx: number, az: number, bz: number) => {
    kit.box(name, ax, bx, GROUND, top, az, bz, m.plaster);
    kit.box(`${name}Cap`, ax - 0.3, bx + 0.3, top, top + 0.4, az - 0.3, bz + 0.3, m.roof);
  };
  wall("wallS", x0, x1, z0, z0 + 1.5);
  wall("wallN", x0, x1, z1 - 1.5, z1);
  // The east wall has fallen in behind the hall: the way down to the Flooded Arcade.
  wall("wallES", x1 - 1.5, x1, z0 + 1.5, BREACH.z0);
  wall("wallEN", x1 - 1.5, x1, BREACH.z1, z1 - 1.5);
  // The west wall meets the stair lane's walls (z 1 and 12.5), leaving its top open.
  wall("wallWS", x0, x0 + 1.5, z0 + 1.5, 1);
  wall("wallWN", x0, x0 + 1.5, 12.5, z1 - 1.5);
}

// --- Main gate: south half standing, north half collapsed ---------------------------

function buildGate(kit: Kit, scene: Scene, m: Mats): void {
  const xa = 114;
  const xb = 121;
  kit.box("gateBase", xa - 0.2, xb + 0.2, GROUND, GROUND + 0.3, -1.2, 14.7, m.stone, { cast: false });
  const base = GROUND + 0.3;
  const pillarTop = base + 7;
  for (const x of [xa + 0.5, xb - 0.5]) {
    for (const [z, h] of [[-0.5, 7], [4, 7], [9.5, 6.2], [14, 2.4]] as const) {
      const p = MeshBuilder.CreateCylinder("gatePillar", { diameter: 0.75, height: h, tessellation: 10 }, scene);
      p.position.set(x, base + h / 2, z);
      kit.add(p, m.red, { tile: 2 });
    }
  }
  // Side bays: closed walls (the guardian rooms).
  kit.box("gateBayS", xa + 0.9, xb - 0.9, base, base + 5.5, -0.4, 3.6, m.plaster);
  kit.box("gateBayN", xa + 0.9, xb - 0.9, base, base + 2.6, 9.9, 13.9, m.plaster);
  kit.box("gateBayNRubble", xa + 0.5, xb - 0.2, base, base + 1.2, 9.6, 14.6, m.rubble);
  // Beams and the standing half of the roof.
  kit.box("gateBeamW", xa + 0.2, xa + 0.8, pillarTop - 0.5, pillarTop, -1, 10, m.red);
  kit.box("gateBeamE", xb - 0.8, xb - 0.2, pillarTop - 0.5, pillarTop, -1, 10, m.red);
  for (const z of [-0.5, 4, 9.5]) kit.box("gateTie", xa + 0.2, xb - 0.2, pillarTop - 0.45, pillarTop, z - 0.3, z + 0.3, m.red);
  const ridge = TEMPLE.gateRoof.y - 0.05;
  // Roof slabs run along the ridge from z -2.5 to 8.
  for (const side of [-1, 1]) {
    const eave = new Vector3(117.5 + side * 5.2, pillarTop + 0.1, 2.75);
    const top = new Vector3(117.5, ridge, 2.75);
    kit.slope("gateRoof", side < 0 ? eave : top, side < 0 ? top : eave, 10.5, 0.45, m.roof);
  }
  kit.box("gateRidge", 117.2, 117.8, ridge - 0.2, ridge + 0.15, -2.5, 8, m.roof);
  // The fallen north half: a roof slab leaning on the rubble.
  kit.slope("gateRoofFallen", new Vector3(117.5, base + 0.4, 17.5), new Vector3(117.5, pillarTop - 0.6, 9.2), 9, 0.45, m.roof, { collide: false });
}

// --- Courtyard: lanterns, offering racks, persimmon tree -----------------------------

function buildCourtyard(kit: Kit, scene: Scene, m: Mats, r: () => number): Mesh[] {
  const lanterns: Mesh[] = [];
  for (const x of [128, 136, 144, 152, 160, 168]) {
    for (const side of [-1, 1]) {
      const z = AXIS_Z + side * 3.4;
      if (x === 144 && side > 0) {
        // Toppled: lying across the gravel.
        const fallen = MeshBuilder.CreateBox("lanternFallen", { width: 1.9, height: 0.6, depth: 0.6 }, scene);
        fallen.position.set(x + 0.6, GROUND + 0.3, z + 0.4);
        fallen.rotation.y = 0.5;
        lanterns.push(kit.add(fallen, m.stone, { keep: true }));
        continue;
      }
      lanterns.push(courtyardLantern(scene, kit, m, x, z));
    }
  }

  // Wooden racks hung with small wish plaques; the Tithe Ant mound is underneath.
  const rackX = TEMPLE.antMound.x;
  const rackZ = TEMPLE.antMound.z;
  for (const dz of [-1.4, 1.4]) {
    for (const dx of [-2.2, 2.2]) kit.box("rackPost", rackX + dx - 0.08, rackX + dx + 0.08, GROUND, GROUND + 2, rackZ + dz - 0.08, rackZ + dz + 0.08, m.wood);
    for (const y of [1.2, 1.85]) kit.box("rackBar", rackX - 2.3, rackX + 2.3, GROUND + y - 0.05, GROUND + y + 0.05, rackZ + dz - 0.05, rackZ + dz + 0.05, m.wood);
    for (let i = 0; i < 14; i++) {
      if (r() < 0.3) continue;
      const x = rackX - 2 + (i % 7) * 0.62 + r() * 0.1;
      const y = GROUND + (i < 7 ? 1.05 : 1.7);
      const plaque = MeshBuilder.CreateBox("plaque", { width: 0.42, height: 0.28, depth: 0.03 }, scene);
      plaque.position.set(x, y, rackZ + dz + 0.06);
      plaque.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.3);
      kit.add(plaque, m.wood, { collide: false, cast: false, tile: 0.8 });
    }
  }

  // Persimmon tree in the south-east corner; its fallen fruit feeds the ants.
  const tx = TEMPLE.fruitPile.x;
  const tz = TEMPLE.fruitPile.z - 2;
  const trunk = MeshBuilder.CreateCylinder("persimmonTrunk", { diameterTop: 0.35, diameterBottom: 0.7, height: 6, tessellation: 8 }, scene);
  trunk.position.set(tx, GROUND + 3, tz);
  trunk.rotation.z = 0.12;
  kit.add(trunk, m.bark);
  for (const [dx, dy, dz, d] of [[0, 7, 0, 5], [1.8, 6.2, 1, 3.6], [-1.6, 6.4, -0.6, 3.4], [0.4, 8.4, 0.8, 3]]) {
    const crown = MeshBuilder.CreateSphere("persimmonCrown", { diameter: d, segments: 6 }, scene);
    crown.scaling.y = 0.75;
    crown.position.set(tx + dx, GROUND + dy, tz + dz);
    kit.add(crown, m.leaves, { collide: false });
    leafShell(kit, scene, m, crown);
  }
  const fruit = kit.flat("persimmon", 0.9, 0.42, 0.1);
  fruit.emissiveColor = new Color3(0.08, 0.03, 0);
  for (let i = 0; i < 26; i++) {
    const f = MeshBuilder.CreateSphere("fallenFruit", { diameter: 0.16 + r() * 0.06, segments: 2 }, scene);
    f.scaling.y = 0.75;
    const a = r() * Math.PI * 2;
    const d = r() * 1.6;
    f.position.set(TEMPLE.fruitPile.x + Math.cos(a) * d, GROUND + 0.06, TEMPLE.fruitPile.z + Math.sin(a) * d);
    kit.add(f, fruit, { collide: false, cast: false });
  }
  return lanterns;
}

/**
 * A stone lantern (tōrō) as one scannable mesh, after its Logbook photograph: hexagonal plinth, round
 * post, a moss-capped platform, a fire box with dark open windows, a wide roof with upturned corners
 * and a jewel finial. Unlit: nothing in the temple carries a flame any more.
 */
function courtyardLantern(scene: Scene, kit: Kit, _m: Mats, x: number, z: number): Mesh {
  const stone = weatheredStone(scene);
  const f = new Form(scene, "stoneLantern");
  const y = GROUND;
  f.lathe([[.55, 0], [.55, .14], [.42, .2], [.42, .3], [.2, .36]], [x, y, z], stone, 6);
  const post = MeshBuilder.CreateCylinder("stoneLantern", { diameterTop: .28, diameterBottom: .34, height: .95, tessellation: 10 }, scene);
  post.position.set(x, y + .82, z); f.add(post, stone);
  f.ellipsoid([x, y + .88, z], [.38, .1, .38], stone, 8);
  f.lathe([[.18, 0], [.48, .08], [.48, .2], [.3, .24]], [x, y + 1.28, z], stone, 6);
  // Fire box: hexagonal, with dark window recesses on two faces.
  const box = MeshBuilder.CreateCylinder("stoneLantern", { diameter: .62, height: .5, tessellation: 6 }, scene);
  box.position.set(x, y + 1.77, z); f.add(box, stone);
  const hollow = kit.flat("lanternHollow", 0.06, 0.055, 0.05);
  for (const a of [0, Math.PI]) {
    const w = MeshBuilder.CreateBox("stoneLantern", { width: .04, height: .3, depth: .24 }, scene);
    w.position.set(x + Math.cos(a) * .27, y + 1.78, z + Math.sin(a) * .27); f.add(w, hollow);
  }
  // Roof: a low hexagonal cone with each corner curling up.
  f.lathe([[.06, .42], [.3, .3], [.62, .1], [.7, 0], [.66, -.04], [.3, .06], [.06, .1]], [x, y + 2.02, z], stone, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    f.taper([[x + Math.cos(a) * .6, y + 2.06, z + Math.sin(a) * .6], [x + Math.cos(a) * .72, y + 2.14, z + Math.sin(a) * .72], [x + Math.cos(a) * .76, y + 2.24, z + Math.sin(a) * .76]], .05, .025, stone, 5);
  }
  f.ellipsoid([x, y + 2.52, z], [.2, .14, .2], stone, 8);
  f.lathe([[0, .3], [.06, .22], [.1, .12], [.06, .03], [.04, 0]], [x, y + 2.56, z], stone, 8);
  const lantern = Mesh.MergeMeshes(f.finish(), true, true, undefined, false, true)!;
  lantern.name = "stoneLantern";
  // kit.add sets the material: keep the multi-material by re-applying it afterwards.
  const multi = lantern.material;
  kit.add(lantern, stone, { keep: true });
  lantern.material = multi;
  return lantern;
}

// --- Bell tower and the fallen bell ---------------------------------------------------

function buildBellTower(kit: Kit, scene: Scene, m: Mats): Mesh {
  const { x, z } = TEMPLE.bell;
  kit.box("bellBase", x - 4, x + 4, GROUND, GROUND + 0.5, z - 4, z + 4, m.stone, { cast: false });
  const top = GROUND + 0.5;
  for (const [dx, dz, h] of [[-3, -3, 7], [3, -3, 2.2], [-3, 3, 7], [3, 3, 4.5]] as const) {
    const p = MeshBuilder.CreateCylinder("bellPillar", { diameter: 0.6, height: h, tessellation: 8 }, scene);
    p.position.set(x + dx, top + h / 2, z + dz);
    kit.add(p, m.red, { tile: 2 });
  }
  kit.box("bellBeam", x - 3.3, x - 2.7, top + 6.5, top + 7, z - 3.3, z + 3.3, m.red);
  // The tower roof slid off to the east and lies against the broken pillars.
  kit.slope("bellRoofFallen", new Vector3(x + 6.5, GROUND + 0.3, z), new Vector3(x + 1.5, top + 4.4, z), 7.5, 0.4, m.roof, { collide: false });
  // The bell lies on its side, mouth to the south (Temple Bell photo): a cast bronze body gone to
  // verdigris, raised bands, a grid of studs on the shoulder, a thick lip and the hanging loop.
  const bronze = organic(scene, "temple-bell-bronze", "#4a5847", "bronze");
  bronze.specularColor = new Color3(0.1, 0.11, 0.09);
  const f = new Form(scene, "templeBell");
  const H = 2.8;
  f.lathe([[0, H / 2 + .02], [.62, H / 2], [.75, H / 2 - .25], [.8, .2], [.92, -H / 2 + .35], [1.1, -H / 2 + .05], [1.13, -H / 2], [1.0, -H / 2 + .04], [.9, -H / 2 + .2]], [0, 0, 0], bronze, 20);
  for (const yy of [.45, -.15, -.95]) {
    const band = MeshBuilder.CreateTorus("templeBell", { diameter: (yy > 0 ? .78 : yy > -.5 ? .84 : 1.0) * 2, thickness: .07, tessellation: 24 }, scene);
    band.position.y = yy; f.add(band, bronze);
  }
  // Studs (chi) in four panels around the shoulder.
  for (let q = 0; q < 4; q++) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const a = q * Math.PI / 2 + (col - 1) * .2, yy = .95 - row * .17, rad = .75 + row * .01;
    f.ellipsoid([Math.cos(a) * rad, yy, Math.sin(a) * rad], [.09, .09, .09], bronze, 5);
  }
  const loop = MeshBuilder.CreateTorus("templeBell", { diameter: .55, thickness: .16, tessellation: 12 }, scene);
  loop.position.y = H / 2 + .2; loop.rotation.x = Math.PI / 2; f.add(loop, bronze);
  const bell = f.finish()[0];
  bell.rotation.x = Math.PI / 2 - 0.12;
  bell.position.set(x - 0.5, top + 1.05, z - 0.4);
  bell.bakeCurrentTransformIntoVertices();
  bell.name = "templeBell";
  kit.add(bell, bronze, { keep: true });
  return bell;
}

// --- Koi pond: wetland, island, bridge -------------------------------------------------

function buildPond(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const p = TEMPLE.pond;
  const water = MeshBuilder.CreateGround("templePond", { width: p.x1 - p.x0, height: p.z1 - p.z0 }, scene);
  water.position.set((p.x0 + p.x1) / 2, p.water, (p.z0 + p.z1) / 2);
  water.material = m.water;
  water.isPickable = false;
  // Rim stones.
  for (let i = 0; i < 46; i++) {
    const t = r();
    const side = Math.floor(r() * 4);
    const x = side < 2 ? p.x0 + t * (p.x1 - p.x0) : side === 2 ? p.x0 : p.x1;
    const z = side < 2 ? (side === 0 ? p.z0 : p.z1) : p.z0 + t * (p.z1 - p.z0);
    if (z === p.z1 && Math.abs(x - TEMPLE.bridge.x) < 2.5) continue;
    const s = 0.5 + r() * 0.8;
    const rock = MeshBuilder.CreateSphere("rimStone", { diameter: 1, segments: 4 }, scene);
    rock.scaling.set(s * 1.4, s * 0.55, s);
    rock.position.set(x + (r() - 0.5), GROUND - 0.1, z + (r() - 0.5));
    rock.rotation.y = r() * 3;
    kit.add(rock, m.stone, { collide: false, tile: 1 });
  }
  // Island with a small lantern and a pine.
  const island = MeshBuilder.CreateCylinder("pondIsland", { diameterTop: 5.4, diameterBottom: 6.4, height: 0.9, tessellation: 14 }, scene);
  island.position.set(TEMPLE.bridge.x, p.bed + 0.4, -19.5);
  kit.add(island, m.moss, { tile: 2 });
  stoneLantern(kit, scene, m.stone, m.lanternLight, TEMPLE.bridge.x + 1.2, p.bed + 0.85, -20.5);
  const pine = MeshBuilder.CreateCylinder("islandPine", { diameterTop: 0.2, diameterBottom: 0.45, height: 4.5, tessellation: 6 }, scene);
  pine.position.set(TEMPLE.bridge.x - 1.2, p.bed + 3, -20);
  pine.rotation.z = 0.35;
  kit.add(pine, m.bark);
  for (const [dx, dy, d] of [[-2, 4.7, 2.6], [-1.2, 5.4, 2], [-2.6, 4.2, 1.8]]) {
    const c = MeshBuilder.CreateSphere("pineCrown", { diameter: d, segments: 5 }, scene);
    c.scaling.y = 0.45;
    c.position.set(TEMPLE.bridge.x + dx, p.bed + dy, -20);
    kit.add(c, m.leaves, { collide: false });
  }
  // Arched red bridge from the north shore to the island.
  const bx = TEMPLE.bridge.x;
  const mid = (TEMPLE.bridge.z0 + TEMPLE.bridge.z1) / 2;
  const a = new Vector3(bx, GROUND + 0.02, TEMPLE.bridge.z0);
  const b = new Vector3(bx, GROUND + 0.75, mid);
  const c = new Vector3(bx, p.bed + 0.85, TEMPLE.bridge.z1);
  kit.slope("bridgeUp", a, b, 2.6, 0.3, m.red);
  kit.slope("bridgeDown", b, c, 2.6, 0.3, m.red);
  for (const side of [-1, 1]) {
    const off = new Vector3(side * 1.25, 0.9, 0);
    kit.slope("bridgeRail", a.add(off), b.add(off), 0.12, 0.12, m.red);
    kit.slope("bridgeRail", b.add(off), c.add(off), 0.12, 0.12, m.red);
    for (const t of [0, 0.5, 1, 1.5, 2]) {
      const q = t <= 1 ? Vector3.Lerp(a, b, t) : Vector3.Lerp(b, c, t - 1);
      kit.box("bridgePost", bx + side * 1.25 - 0.07, bx + side * 1.25 + 0.07, q.y - 0.2, q.y + 0.95, q.z - 0.07, q.z + 0.07, m.red);
    }
  }
  // Lily pads on the open water.
  const pad = kit.flat("lilyPad", 0.2, 0.42, 0.16);
  for (let i = 0; i < 40; i++) {
    const x = p.x0 + 1 + r() * (p.x1 - p.x0 - 2);
    const z = p.z0 + 1 + r() * (p.z1 - p.z0 - 2);
    if (Math.abs(x - bx) < 2 && z > -17) continue;
    const disc = MeshBuilder.CreateDisc("lilyPad", { radius: 0.25 + r() * 0.35, tessellation: 9, arc: 0.88 }, scene);
    disc.rotation.set(Math.PI / 2, r() * 6, 0);
    disc.position.set(x, p.water + 0.015, z);
    kit.add(disc, pad, { collide: false, cast: false });
  }
}

// --- Main hall ---------------------------------------------------------------------------

function buildHall(kit: Kit, scene: Scene, m: Mats): { offeringBox: Mesh; scrollShelf: Mesh; wishWall: Mesh } {
  const h = TEMPLE.hall;
  const fl = h.floor;
  // Stone platform and front steps.
  kit.box("hallPlatform", h.x0 - 1, h.x1 + 1, GROUND, fl, h.z0 - 1, h.z1 + 1, m.concrete, { cast: false });
  kit.box("hallFloor", h.x0 + 0.4, h.x1 - 0.4, fl, fl + 0.04, h.z0 + 0.4, h.z1 - 0.4, m.floor, { cast: false });
  stairs(kit, scene, "hallSteps", h.x0 - 3.5, h.x0 - 1, AXIS_Z - 3.5, AXIS_Z + 3.5, GROUND, fl, m.stone);
  // Walls: dark timber below, plaster above.
  const t = 0.4;
  const wall = (name: string, x0: number, x1: number, z0: number, z1: number, y1 = h.wall) => {
    kit.box(name, x0, x1, fl, Math.min(fl + 5, y1), z0, z1, m.wood);
    if (y1 > fl + 5) kit.box(`${name}Up`, x0, x1, fl + 5, y1, z0, z1, m.plaster);
  };
  wall("hallFrontS", h.x0, h.x0 + t, h.z0, AXIS_Z - 2.75);
  wall("hallFrontN", h.x0, h.x0 + t, AXIS_Z + 2.75, h.z1);
  kit.box("hallLintel", h.x0, h.x0 + t, fl + 5, h.wall, AXIS_Z - 2.75, AXIS_Z + 2.75, m.plaster);
  wall("hallBack", h.x1 - t, h.x1, h.z0, h.z1);
  wall("hallSouthW", h.x0, 188, h.z0, h.z0 + t, fl + 6.5);
  wall("hallSouthE", 188, h.x1, h.z0, h.z0 + t, fl + 4.5);
  wall("hallNorth", h.x0, h.x1, h.z1 - t, h.z1);
  // The sanctum: the north end, closed off by a screen wall with one doorway.
  const sz = TEMPLE.sanctum.z;
  const door = TEMPLE.sanctum.door;
  kit.box("sanctumWallW", h.x0 + t, door.x0, fl, h.wall, sz, sz + 0.3, m.darkWood);
  kit.box("sanctumWallE", door.x1, TEMPLE.gallery.x0, fl, h.wall, sz, sz + 0.3, m.darkWood);
  kit.box("sanctumLintel", door.x0, door.x1, fl + 3.6, h.wall, sz, sz + 0.3, m.darkWood);
  // Under the gallery the screen stops, leaving a gap for the gallery to pass.
  kit.box("sanctumWallG", TEMPLE.gallery.x0, h.x1 - t, fl, TEMPLE.gallery.y - 0.3, sz, sz + 0.3, m.darkWood);
  // Gable over the north end (stepped).
  for (const [w, y0, y1] of [[7, h.wall, h.wall + 2], [4.2, h.wall + 2, h.wall + 4], [1.8, h.wall + 4, h.wall + 5.6]]) {
    kit.box("hallGable", 190 - w, 190 + w, y0, y1, h.z1 - t, h.z1, m.plaster);
  }
  // Timber posts along the outside and inside.
  for (let z = h.z0; z <= h.z1 + 0.01; z += 4) {
    for (const x of [h.x0 - 0.15, h.x1 + 0.15]) {
      if (x < 190 && Math.abs(z - AXIS_Z) < 3) continue;
      const p = MeshBuilder.CreateCylinder("hallPost", { diameter: 0.5, height: h.wall - fl, tessellation: 8 }, scene);
      p.position.set(x, (fl + h.wall) / 2, z);
      kit.add(p, m.red, { tile: 2 });
    }
  }
  for (const x of [185, 195]) {
    for (const z of [-6, -0.7, 4.6, 9.9, 15.2, 20.5]) {
      if (x === 195 && z === -0.7) continue; // fell when the cedar grew
      const p = MeshBuilder.CreateCylinder("hallPillar", { diameter: 0.6, height: h.wall - fl, tessellation: 10 }, scene);
      p.position.set(x, (fl + h.wall) / 2, z);
      kit.add(p, m.red, { tile: 2 });
    }
  }
  // Roof over the north half; the south half fell in around the cedar.
  const ridgeY = 25;
  for (const side of [-1, 1]) {
    const eave = new Vector3(190 + side * 12.5, 18.6, 16.25);
    const ridge = new Vector3(190, ridgeY, 16.25);
    kit.slope("hallRoof", side < 0 ? eave : ridge, side < 0 ? ridge : eave, 18.5, 0.5, m.roof);
  }
  kit.box("hallRidge", 189.6, 190.4, ridgeY - 0.3, ridgeY + 0.3, 6.8, 25.6, m.roof);
  // Bare rafters over the open half, and a slab hanging into the hall.
  for (const z of [-6.5, -2, 2.5]) kit.box("rafter", h.x0, h.x1, h.wall, h.wall + 0.45, z - 0.2, z + 0.2, m.wood);
  kit.box("rafterRidge", 189.8, 190.2, h.wall, ridgeY - 0.5, -1.6, -1.2, m.wood, { collide: false });
  kit.slope("hallRoofHanging", new Vector3(183, 21.8, 7), new Vector3(183, 15.5, 2.2), 5, 0.4, m.roof, { collide: false });
  kit.slope("hallRoofDown", new Vector3(194, fl, -7.6), new Vector3(194, fl + 3, -4), 5, 0.4, m.roof, { collide: false });

  // The upper gallery along the back wall and the beam that leads up to it.
  const g = TEMPLE.gallery;
  kit.box("gallery", g.x0, g.x1, g.y - 0.3, g.y, g.z0, g.z1, m.wood);
  for (const z of [g.z0 + 1, 7, 13, g.z1 - 1]) kit.box("galleryBracket", g.x0 + 0.6, g.x1, g.y - 1.4, g.y - 0.3, z - 0.15, z + 0.15, m.wood, { collide: false });
  kit.slope("fallenBeam", new Vector3(198.5, fl, -8.2), new Vector3(198.5, g.y, g.z0 + 0.4), 1.6, 0.6, m.wood);

  // Fallen beams across the floor (Scroll Caps grow on these).
  kit.slope("floorBeam", new Vector3(182.5, fl + 0.3, -4.5), new Vector3(187.5, fl + 0.3, -2), 0.5, 0.5, m.wood);
  kit.slope("floorBeam", new Vector3(194, fl + 0.3, 3.5), new Vector3(196.8, fl + 0.3, -0.5), 0.5, 0.5, m.wood);

  // Scroll shelf along the south wall: scannable, with Scroll Caps on it (Scroll Shelf photo): a dark
  // timber case of three shelves and four bays, packed with tied scrolls whose ends face the hall.
  const caseWood = organic(scene, "scroll-shelf-timber", "#4b3a2b", "bark");
  const paper = organic(scene, "scroll-paper", "#b9a47a");
  const cord = organic(scene, "scroll-cord", "#6a4a2c");
  // Built around the shelf's centre, then placed against the wall.
  const sf = new Form(scene, "scrollShelf");
  const front = 0.42;
  sf.box([0, -1.04, 0], [6, 0.12, 0.9], caseWood);
  sf.box([0, 1.05, 0], [6.2, 0.14, 0.95], caseWood);
  sf.box([0, 0, -0.42], [6, 2.2, 0.06], caseWood);
  for (const yy of [-0.35, 0.35]) sf.box([0, yy, 0], [6, 0.07, 0.88], caseWood);
  for (let i = 0; i <= 4; i++) sf.box([-3 + i * 1.5, 0, 0.02], [0.12, 2.2, 0.9], caseWood);
  const sr = rng(331);
  for (let shelfRow = 0; shelfRow < 3; shelfRow++) {
    const base = -0.98 + shelfRow * 0.7;
    for (let bay = 0; bay < 4; bay++) {
      // Layers of scrolls stacked like logs, ends towards the hall.
      for (let layer = 0; layer < 3; layer++) for (let k = 0; k < 9 - layer; k++) {
        if (sr() < 0.12) continue;
        const d = 0.12 + sr() * 0.03;
        const roll = MeshBuilder.CreateCylinder("scrollShelf", { diameter: d, height: 0.62 + sr() * 0.18, tessellation: 7 }, scene);
        roll.rotation.x = Math.PI / 2;
        roll.position.set(-3 + bay * 1.5 + 0.18 + k * 0.14 + layer * 0.07, base + 0.07 + layer * 0.12, front - 0.4 + sr() * 0.06);
        sf.add(roll, sr() < 0.25 ? cord : paper);
      }
    }
  }
  const shelf = Mesh.MergeMeshes(sf.finish(), true, true, undefined, false, true)!;
  shelf.name = "scrollShelf";
  const shelfMats = shelf.material;
  shelf.position.set(184.8, fl + 1.1, h.z0 + t + 0.45);
  kit.add(shelf, caseWood, { keep: true });
  shelf.material = shelfMats;

  // Offering box at the top of the front steps (Offering Box photo): a heavy timber chest with a
  // slatted top, iron-banded corners and a round crest on the front.
  const ob = TEMPLE.offeringBox;
  const boxWood = organic(scene, "offering-box-timber", "#6a5640", "bark");
  const iron = organic(scene, "offering-box-iron", "#3d3b36", "rusted");
  const of = new Form(scene, "templeOfferingBox");
  of.box([0, 0.38, 0], [0.8, 0.76, 2], boxWood);
  of.box([0, 0.8, 0], [0.9, 0.08, 2.1], boxWood);
  for (let i = 0; i < 11; i++) {
    // Louvred slats: coins once slid between them.
    const slat = of.box([0, 0.87, -0.9 + i * 0.18], [0.84, 0.05, 0.1], boxWood);
    slat.rotation.x = 0.35;
  }
  for (const dz of [-1, 1]) for (const dx of [-1, 1]) of.box([dx * 0.4, 0.4, dz * 0.98], [0.06, 0.82, 0.12], iron);
  const crest = MeshBuilder.CreateCylinder("templeOfferingBox", { diameter: 0.42, height: 0.04, tessellation: 16 }, scene);
  crest.rotation.z = Math.PI / 2; crest.position.set(-0.42, 0.42, 0); of.add(crest, iron);
  for (let i = 0; i < 8; i++) {
    const petal = of.ellipsoid([-0.445, 0.42 + Math.cos(i * Math.PI / 4) * 0.11, Math.sin(i * Math.PI / 4) * 0.11], [0.02, 0.09, 0.09], iron, 5);
    petal.rotation.x = i * Math.PI / 4;
  }
  const offeringBox = Mesh.MergeMeshes(of.finish(), true, true, undefined, false, true)!;
  offeringBox.name = "templeOfferingBox";
  const offeringMats = offeringBox.material;
  offeringBox.position.set(ob.x, ob.y, ob.z);
  kit.add(offeringBox, boxWood, { keep: true });
  offeringBox.material = offeringMats;

  // The Wish Wall: thousands of small wooden plaques on the north end wall.
  const wish = MeshBuilder.CreatePlane("wishWall", { width: 13, height: 4.4 }, scene);
  wish.position.set(189.5, fl + 2.6, h.z1 - t - 0.03);
  const wishMat = new StandardMaterial("wishWall", scene);
  wishMat.diffuseTexture = paint(scene, "tex:wishWall", 1024, drawWishWall);
  wishMat.specularColor = Color3.Black();
  wishMat.emissiveColor = new Color3(0.05, 0.04, 0.03);
  wish.material = wishMat;
  wish.receiveShadows = true;
  kit.box("wishFrame", 182.8, 196.2, fl + 0.3, fl + 0.4, h.z1 - t - 0.25, h.z1 - t, m.wood, { collide: false });
  kit.box("wishFrameTop", 182.8, 196.2, fl + 4.8, fl + 4.95, h.z1 - t - 0.25, h.z1 - t, m.wood, { collide: false });

  return { offeringBox, scrollShelf: shelf, wishWall: wish };
}

function drawWishWall(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  // The texture is stretched about 3x sideways on the wall, so plaques are drawn narrow.
  c.fillStyle = "#211812";
  c.fillRect(0, 0, s, s);
  const rows = 17;
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row < rows; row++) {
      const y = 14 + row * (s / rows) + layer * 18;
      c.strokeStyle = "rgba(120, 40, 30, 0.6)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(s, y + (r() - 0.5) * 8);
      c.stroke();
      for (let x = r() * 6; x < s; x += 7 + r() * 6) {
        if (r() < 0.12) continue;
        const w = 7 + r() * 4;
        const h = 26 + r() * 16;
        const tone = layer === 0 ? 80 + r() * 50 : 120 + r() * 80;
        c.save();
        c.translate(x + w / 2, y + 2);
        c.rotate((r() - 0.5) * 0.5);
        c.fillStyle = `rgb(${tone}, ${tone * 0.78}, ${tone * 0.55})`;
        c.beginPath();
        c.moveTo(-w / 2, 4);
        c.lineTo(0, 0);
        c.lineTo(w / 2, 4);
        c.lineTo(w / 2, h);
        c.lineTo(-w / 2, h);
        c.closePath();
        c.fill();
        // Some still carry a painted motif.
        if (r() < 0.12) {
          c.fillStyle = r() < 0.5 ? "rgba(150, 50, 40, 0.7)" : "rgba(60, 80, 120, 0.6)";
          c.fillRect(-w / 2 + 1, 8, w - 2, 6);
        }
        // Faded brush marks in the fictional script, in a column.
        c.fillStyle = `rgba(25, 18, 12, ${0.3 + r() * 0.45})`;
        for (let k = 0; k < 3 + r() * 4; k++) c.fillRect(-1.5 + (r() - 0.5) * 2, 14 + k * 4, 2.5 + r() * 1.5, 2);
        c.restore();
      }
    }
  }
}

// --- Pagoda: five tiers, climbable through broken eave corners --------------------------

function buildPagoda(kit: Kit, scene: Scene, m: Mats): Vector3 {
  const { x, z } = TEMPLE.pagoda;
  const H = PAGODA_TIER_HEIGHT;
  kit.box("pagodaBase", x - 6, x + 6, GROUND, GROUND + 0.3, z - 6, z + 6, m.stone, { cast: false });
  let floor = GROUND + 0.3;
  PAGODA_TIERS.forEach((s, j) => {
    const top = GROUND + H * (j + 1);
    const E = s + 1.6;
    // Thick eaves: their front face is what the robot grabs when climbing.
    const ey = top - 1;
    // Tier body.
    kit.box("pagodaBody", x - s, x + s, floor, ey, z - s, z + s, j % 2 ? m.plaster : m.red);
    // Eave, built from pieces so one corner can stay open. Each piece is an
    // invisible collider plus a tiled roof over a set-back timber band, so the
    // eave reads as a roof on brackets rather than a slab.
    const eave = (x0: number, x1: number, z0: number, z1: number) => {
      kit.box("pagodaEave", x0, x1, ey, top, z0, z1, m.roof, { hidden: true });
      kit.box("pagodaEaveRoof", x0, x1, top - 0.35, top, z0, z1, m.roof, { collide: false });
      const inset = (v: number, edge: number, d: number) => (Math.abs(v - edge) < 1e-6 ? v + d : v);
      kit.box(
        "pagodaEaveBand",
        inset(x0, x - E, 0.6),
        inset(x1, x + E, -0.6),
        ey,
        top - 0.35,
        inset(z0, z - E, 0.6),
        inset(z1, z + E, -0.6),
        m.wood,
        { collide: false },
      );
    };
    eave(x - E, x + E, z - s, z + s);
    eave(x - s, x + s, z + s, z + E);
    eave(x - s, x + s, z - E, z - s);
    const [gx, gz] = CLIMB_CORNERS[j];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if (sx === gx && sz === gz) continue;
        const cx0 = sx > 0 ? x + s : x - E;
        const cz0 = sz > 0 ? z + s : z - E;
        eave(cx0, cx0 + 1.6, cz0, cz0 + 1.6);
      }
    }
    // A fallen beam stack on the level below, under the open corner, to climb on.
    const bx = x + gx * (s + 0.8);
    const bz = z + gz * (s + 0.8);
    kit.box("pagodaClimb", bx - 0.6, bx + 0.6, floor, floor + 1.6, bz - 0.6, bz + 0.6, j === 0 ? m.rubble : m.wood);
    floor = top;
  });
  // Spire on the top roof.
  const spire = MeshBuilder.CreateCylinder("pagodaSpire", { diameterTop: 0.08, diameterBottom: 0.35, height: 5, tessellation: 8 }, scene);
  spire.position.set(x, floor + 2.5, z);
  kit.add(spire, m.bronze);
  for (let i = 0; i < 6; i++) {
    const ring = MeshBuilder.CreateTorus("spireRing", { diameter: 0.9 - i * 0.08, thickness: 0.07, tessellation: 10 }, scene);
    ring.position.set(x, floor + 1 + i * 0.5, z);
    kit.add(ring, m.bronze, { collide: false });
  }
  return new Vector3(x, floor, z);
}

// --- Trees, forest beyond the walls and the far city -----------------------------------

function leafShell(kit: Kit, scene: Scene, m: Mats, blob: Mesh): void {
  const shell = MeshBuilder.CreateSphere("leafShell", { diameter: 1, segments: 6 }, scene);
  shell.scaling.copyFrom(blob.scaling).scaleInPlace(blob.getBoundingInfo().boundingBox.extendSize.x * 2 * 1.22);
  shell.position.copyFrom(blob.position);
  kit.add(shell, m.foliage, { collide: false, cast: false, tile: 1.6 });
}

function buildSurroundings(scene: Scene, r: () => number, m: Mats): void {
  // Merged into a handful of meshes, not part of the kit (no collisions, no shadows).
  const crowns: Mesh[] = [];
  const shells: Mesh[] = [];
  const { x0, x1, z0, z1 } = TEMPLE;
  // Forest crowding the walls on three sides (the west side looks down the hill).
  const ring = (x: number, z: number) => {
    const d = 6 + r() * 7;
    const c = MeshBuilder.CreateSphere("forestCrown", { diameter: d, segments: 4 }, scene);
    c.scaling.y = 0.8;
    c.position.set(x, GROUND + 4 + r() * 8, z);
    crowns.push(c);
    const sh = MeshBuilder.CreateSphere("forestShell", { diameter: d * 1.18, segments: 5 }, scene);
    sh.scaling.y = 0.8;
    sh.position.copyFrom(c.position);
    shells.push(sh);
  };
  for (let x = x0 + 4; x < x1 + 8; x += 5 + r() * 4) {
    ring(x, z0 - 4 - r() * 8);
    ring(x, z1 + 4 + r() * 8);
  }
  for (let z = z0; z < z1; z += 5 + r() * 4) {
    // Keep the sunken path to the arcade clear.
    if (z > BREACH.z0 - 7 && z < BREACH.z1 + 7) continue;
    ring(x1 + 4 + r() * 8, z);
  }
  const merge = (name: string, list: Mesh[], material: StandardMaterial) => {
    const merged = Mesh.MergeMeshes(list, true, true)!;
    merged.name = name;
    merged.material = material;
    merged.isPickable = false;
    merged.receiveShadows = false;
    merged.freezeWorldMatrix();
  };
  merge("forestCrowns", crowns, m.leaves);
  merge("forestShells", shells, m.foliage);
}

/** Undergrowth on the plateau: ferns, giant leaves and grass, thin-instanced. */
function buildPlants(scene: Scene, r: () => number): void {
  const ferns: { x: number; y: number; z: number; s: number }[] = [];
  const leaves: typeof ferns = [];
  const tufts: typeof ferns = [];
  const { x0, x1, z0, z1, pond, hall } = TEMPLE;
  const blocked = (x: number, z: number) =>
    (x > hall.x0 - 4 && x < hall.x1 + 1.5 && z > hall.z0 - 1.5 && z < hall.z1 + 1.5) ||
    (x > pond.x0 - 0.5 && x < pond.x1 + 0.5 && z > pond.z0 - 0.5 && z < pond.z1 + 0.5) ||
    Math.abs(z - AXIS_Z) < 2 ||
    (x > 112 && x < 123 && z > -2 && z < 16) ||
    (x > 126 && x < 134 && z > -5 && z < 2) ||
    (Math.abs(x - TEMPLE.pagoda.x) < 6.5 && Math.abs(z - TEMPLE.pagoda.z) < 6.5) ||
    (Math.abs(x - TEMPLE.bell.x) < 4.5 && Math.abs(z - TEMPLE.bell.z) < 4.5) ||
    (Math.abs(x - TEMPLE.antMound.x) < 3 && Math.abs(z - TEMPLE.antMound.z) < 2.5);
  const scatter = (list: typeof ferns, n: number, s: number, edgeBias: number) => {
    for (let i = 0; i < n; i++) {
      // Biased towards the walls, where the gravel was never swept.
      let x = x0 + 2 + r() * (x1 - x0 - 4);
      let z = z0 + 2 + r() * (z1 - z0 - 4);
      if (r() < edgeBias) {
        const side = Math.floor(r() * 3);
        if (side === 0) z = z0 + 2 + r() * 3;
        else if (side === 1) z = z1 - 2 - r() * 3;
        else x = x1 - 2 - r() * 3;
      }
      if (!blocked(x, z)) list.push({ x, y: GROUND, z, s: s * (0.7 + r() * 0.7) });
    }
  };
  scatter(ferns, 260, 1, 0.55);
  scatter(leaves, 70, 1.5, 0.6);
  scatter(tufts, 900, 0.8, 0.3);
  // Reeds along the pond.
  for (let i = 0; i < 160; i++) {
    const t = r();
    const north = r() < 0.5;
    const x = pond.x0 + t * (pond.x1 - pond.x0);
    const z = north ? pond.z1 - 0.5 - r() * 1.5 : pond.z0 + 0.5 + r() * 1.5;
    if (Math.abs(x - TEMPLE.bridge.x) < 2.2) continue;
    tufts.push({ x, y: pond.bed, z, s: 1.4 + r() * 0.8 });
  }
  scatterCards(scene, "ferns", card(scene, "fern"), 1.4, 1.1, 2, ferns, r);
  scatterCards(scene, "giantLeaves", card(scene, "bigLeaf"), 1.6, 1.8, 2, leaves, r);
  scatterCards(scene, "templeTufts", card(scene, "grassTuft"), 0.8, 0.55, 2, tufts, r);
}
