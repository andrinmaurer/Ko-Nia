import { Color3, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from "../babylon";
import { Kit, scatterCards, stairs, type PieceOptions } from "./kit";
import { buildRelayModel } from "./relay";
import { card, paint, rng, type Ctx } from "./textures";
import { Form, organic, predecessorVisual } from "./life/visuals";

/**
 * Block 5, Tower Foot: the foot of the first skyscraper, at the edge of the
 * Financial District. Layout and content follow docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md.
 *
 *   station maintenance tunnel, east end (x 554)
 *   → corridor D east (x 554..576), then stairwell E south and up (x 572..576, where the blocks swap)
 *   → the tower's car park (y -6) → stairs up into the lobby (y 1.5)
 *   → the tower (x 584..620, z -36..-8), eight storeys, split open on the east side:
 *     broken floor slabs lean from floor to floor up the east bay (the Ledge Kite nests there)
 *   → or, from the plaza, up the fallen crane to the sixth floor and the stairs inside
 *   → the canopy terrace on the roof (y 33.2): Relay Station 5, the skyline, and the Predecessor
 *
 * The plaza in front (north) of the tower is a young forest. The tower's upper
 * shaft rises another 70 m over the south-west of the roof.
 */
const L = [1.5, 8, 11.6, 15.2, 18.8, 22.4, 26, 29.6, 33.2];

export const TOWER = {
  /** Plaza and lobby floor level. */
  ground: L[0],
  /** Floor levels: the lobby (0), floors 2 to 8 (1..7) and the roof terrace (8). */
  levels: L,
  corridorD: { x0: 554, x1: 576, z0: -7, z1: -4, floor: -13.5, ceiling: -10.5 },
  /** Stairwell E: from corridor D south and up to the car park. The blocks swap in here. */
  corridorE: { x0: 572, x1: 576, z0: -31, z1: -7, ceiling: -1.5, stairs: { z0: -9, z1: -24 } },
  carPark: { x0: 578, x1: 626, z0: -38, z1: -10, floor: -6, ceiling: 0.9 },
  /** Car park door, in the stairwell's east wall. */
  carDoor: { z0: -30, z1: -25 },
  /** Stairs from the car park up into the lobby (rising west). */
  stairsG: { x0: 603, x1: 588, z0: -33.5, z1: -31.5 },
  tower: { x0: 584, x1: 620, z0: -36, z1: -8 },
  /** The split east side: broken slabs lean up between the floors in two lanes. */
  bay: { x0: 608, laneA: { x0: 611, x1: 613.5 }, laneB: { x0: 616.5, x1: 619 } },
  /** Double-height lobby in front of the fig columns (no floor 2 there). */
  atrium: { x0: 586, x1: 606, z0: -17, z1: -8 },
  figColumn: new Vector3(596, L[0], -12.5),
  /** Stairs inside, from floor 6 (where the crane comes in) up to the roof. */
  core: { x0: 590, x1: 597.2, lane1: { z0: -23, z1: -21 }, lane2: { z0: -19.5, z1: -17.5 } },
  lift: { x0: 584, x1: 587, z0: -30, z1: -24 },
  boardRoom: { x0: 584, x1: 606, z0: -15.5, z1: -8 },
  shaft: { x0: 584, x1: 608, z0: -36, z1: -24, top: 104 },
  /** The fallen crane's boom: from the plaza up to the sixth floor's west side. */
  crane: { from: new Vector3(540, L[0], -14), to: new Vector3(584.6, L[5], -14) },
  nest: new Vector3(619.1, L[6], -11.5),
  relay: { x: 612, z: -15 },
  predecessor: new Vector3(619, L[8], -30),
  plaza: { x0: 528, x1: 664, z0: -42, z1: 46 },
  fountain: { x: 596, z: 14 },
};

/**
 * Which block to draw for a robot at `p` around the tower, or undefined to defer
 * to the station's own check. Two thresholds in stairwell E give hysteresis.
 */
export function towerRegionAt(p: Vector3, current: "station" | "tower" | string): "station" | "tower" | undefined {
  const e = TOWER.corridorE;
  if (p.y > -2.5 && p.x > TOWER.plaza.x0 - 1) return "tower";
  if (p.x > e.x1 + 1) return "tower";
  if (p.x > e.x0 - 0.5 && p.z < e.z1 - 0.5) {
    if (p.z < -16) return "tower";
    if (p.z > -12) return "station";
    return current === "tower" ? "tower" : "station";
  }
  return undefined;
}

export interface TowerFoot {
  relayStation: Mesh;
  relayGlow: StandardMaterial;
  spawn: Vector3;
  spawnYaw: number;
  revolvingDoor: Mesh[];
  directory: Mesh[];
  elevatorCar: Mesh[];
  cityModel: Mesh[];
  predecessor: Mesh[];
  nest: Mesh[];
  /** Air ducts under the ceilings: the Duct Vine's runs. `burst` marks the split one. */
  ducts: { from: Vector3; to: Vector3; burst: boolean }[];
  /** Desk tops a Window Birch grows through. */
  desks: Vector3[];
  /** Window ledges on the north facade where the Glass Swallows nest. */
  ledges: Vector3[];
}

type Mats = Record<string, StandardMaterial>;
type Hole = { x0: number; x1: number; z0: number; z1: number };

/** Corridor D and stairwell E, from the station's maintenance tunnel up to the car park. Drawn with both blocks. */
export function buildTowerPassage(scene: Scene, shadows: ShadowGenerator): void {
  const kit = new Kit(scene, shadows);
  const m = materials(kit, scene);
  const d = TOWER.corridorD;
  const e = TOWER.corridorE;
  const cp = TOWER.carPark;
  const r = rng(6150);
  // Corridor D: a service corridor like the tunnel, its door blown open.
  kit.box("corridorDFloor", d.x0, d.x1, d.floor - 1, d.floor, d.z0, d.z1, m.floor, { cast: false });
  kit.box("corridorDCeiling", d.x0, d.x1 + 0.4, d.ceiling, d.ceiling + 0.6, d.z0 - 0.4, d.z1 + 0.4, m.ceiling);
  kit.box("corridorDWallN", d.x0, d.x1 + 0.4, d.floor - 1, d.ceiling, d.z1, d.z1 + 0.4, m.concreteDark);
  kit.box("corridorDWallS", d.x0, e.x0, d.floor - 1, d.ceiling, d.z0 - 0.4, d.z0, m.concreteDark);
  // Stairwell E: tall, with the stairs climbing south to a landing at the car park's level.
  kit.box("stairwellEFloor", e.x0, e.x1, d.floor - 1, d.floor, e.stairs.z0, d.z0, m.floor, { cast: false });
  kit.box("stairwellELanding", e.x0, e.x1, cp.floor - 1, cp.floor, e.z0, e.stairs.z1, m.floor, { cast: false });
  stairsZ(kit, scene, "stairwellEStairs", e.x0, e.x1, e.stairs.z0, e.stairs.z1, d.floor, cp.floor, m.concrete);
  kit.box("stairwellEUnder", e.x0, e.x1, d.floor - 1, cp.floor - 1, e.stairs.z1, e.z0, m.concreteDark, { cast: false });
  kit.box("stairwellEWallW", e.x0 - 0.4, e.x0, d.floor - 1, e.ceiling, e.z0 - 0.4, d.z0 - 0.4, m.concreteDark);
  kit.box("stairwellEWallE1", e.x1, e.x1 + 0.4, d.floor - 1, e.ceiling, d.z0, d.z1 + 0.4, m.concreteDark);
  kit.box("stairwellEWallE2", e.x1, e.x1 + 0.4, d.floor - 1, e.ceiling, TOWER.carDoor.z1, d.z0, m.concreteDark);
  kit.box("stairwellEWallE3", e.x1, e.x1 + 0.4, d.floor - 1, e.ceiling, e.z0 - 0.4, TOWER.carDoor.z0, m.concreteDark);
  kit.box("stairwellEDoorHead", e.x1, e.x1 + 0.4, cp.floor + 2.6, e.ceiling, TOWER.carDoor.z0, TOWER.carDoor.z1, m.concreteDark);
  kit.box("stairwellEWallS", e.x0 - 0.4, e.x1 + 0.4, d.floor - 1, e.ceiling, e.z0 - 0.4, e.z0, m.concreteDark);
  kit.box("stairwellECeiling", e.x0 - 0.4, e.x1 + 0.4, e.ceiling, e.ceiling + 0.5, e.z0 - 0.4, d.z0, m.ceiling);
  // Over corridor D's end: the wall from its low ceiling up to the stairwell's.
  kit.box("stairwellEHeader", e.x0 - 0.4, e.x1 + 0.4, d.ceiling, e.ceiling, d.z0 - 0.2, d.z0 + 0.2, m.concreteDark);
  // The passage between corridor D and the car park, through the gap the door left.
  kit.box("carDoorSill", e.x1, cp.x0, cp.floor - 1, cp.floor, TOWER.carDoor.z0, TOWER.carDoor.z1, m.floor, { cast: false });
  // Handrails, pipes, and a door hanging off its frame.
  for (const x of [e.x0 + 0.15, e.x1 - 0.15]) kit.slope("stairwellERail", new Vector3(x, d.floor + 0.9, e.stairs.z0), new Vector3(x, cp.floor + 0.9, e.stairs.z1), 0.06, 0.06, m.steel, { collide: false, cast: false });
  kit.box("corridorDPipe", d.x0, d.x1, d.ceiling - 0.6, d.ceiling - 0.35, d.z1 - 0.3, d.z1 - 0.05, m.rust, { collide: false, cast: false });
  for (const y of [d.ceiling - 1.1, d.ceiling - 1.6]) kit.box("corridorDTray", d.x0, d.x1, y, y + 0.06, d.z0, d.z0 + 0.45, m.rust, { collide: false, cast: false });
  const door = MeshBuilder.CreateBox("blownDoor", { width: 0.08, height: 2.2, depth: 1.8 }, scene);
  door.position.set(d.x0 + 1.2, d.floor + 0.3, d.z0 + 0.8);
  door.rotation.set(0.15, 0.4, Math.PI / 2 - 0.12);
  kit.add(door, m.steel, { collide: false, tile: 1 });
  // Seepage: moss and silt down the stairs.
  for (let i = 0; i < 12; i++) {
    const s = 0.2 + r() * 0.35;
    const rock = MeshBuilder.CreateBox("passageRubble", { width: s * 1.5, height: s * 0.5, depth: s }, scene);
    const z = e.z0 + 0.5 + r() * 6;
    rock.position.set(e.x0 + 0.4 + r() * 3.2, cp.floor + s * 0.2, z);
    rock.rotation.set(r() * 0.3, r() * 3, r() * 0.3);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }
  kit.box("corridorDSilt", d.x0, d.x0 + 8, d.floor, d.floor + 0.03, d.z0 + 0.4, d.z1 - 0.4, m.dirt, { collide: false, cast: false });
  kit.finish();
}

export function buildTowerFoot(scene: Scene, shadows: ShadowGenerator): TowerFoot {
  const kit = new Kit(scene, shadows);
  const m = materials(kit, scene);
  const r = rng(7303);
  buildCarPark(kit, scene, m, r);
  buildGround(kit, scene, m, r);
  const lobby = buildLobby(kit, scene, m, r);
  const floors = buildFloors(kit, scene, m, r);
  buildFacades(kit, scene, m, r);
  buildCore(kit, scene, m);
  const elevatorCar = buildElevator(kit, scene, m);
  const cityModel = buildBoardRoom(kit, scene, m, r);
  buildShaft(kit, scene, m, r);
  buildCrane(kit, m, r);
  buildTerrace(kit, scene, m, r);
  buildPlaza(kit, scene, m, r);
  buildSurroundings(kit, scene, m, r);
  const nest = buildNest(scene);
  const predecessor = buildPredecessor(kit, scene);

  // Relay Station 5, on the terrace.
  const relayGlow = new StandardMaterial("glowTower", scene);
  relayGlow.emissiveColor = new Color3(0.35, 0.85, 1);
  relayGlow.disableLighting = true;
  const solid = (mesh: Mesh, material: StandardMaterial, cast = true) => kit.add(mesh, material, { cast, keep: true });
  const { x, z } = TOWER.relay;
  const relayStation = buildRelayModel(scene, solid, { concrete: m.concrete, metal: m.steel, rust: m.rust, solar: m.solar, alien: kit.flat("alien", 0.12, 0.13, 0.16, 0.6), glow: relayGlow }, x, z, L[8]);

  kit.finish();
  buildPlants(scene, r);
  buildSkyline(scene, r);

  return {
    relayStation,
    relayGlow,
    spawn: new Vector3(x - 2.6, L[8] + 0.2, z + 1.4),
    spawnYaw: Math.PI / 2,
    revolvingDoor: lobby.revolvingDoor,
    directory: lobby.directory,
    elevatorCar,
    cityModel,
    predecessor,
    nest,
    ducts: floors.ducts,
    desks: floors.desks,
    ledges: floors.ledges,
  };
}

// --- Materials -----------------------------------------------------------------------

const TILE_SIZES = new Map<StandardMaterial, number>();

function tiled(kit: Kit, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: StandardMaterial, opts: PieceOptions = {}): Mesh {
  return kit.box(name, x0, x1, y0, y1, z0, z1, material, { tile: TILE_SIZES.get(material), ...opts });
}

function painted(scene: Scene, name: string, size: number, metres: number, draw: (c: Ctx, s: number, r: () => number) => void, spec = 0.05): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const mat = new StandardMaterial(name, scene);
  mat.diffuseTexture = paint(scene, `tex:${name}`, size, draw, false, true);
  mat.specularColor = new Color3(spec, spec, spec);
  TILE_SIZES.set(mat, metres);
  return mat;
}

function materials(kit: Kit, scene: Scene): Mats {
  return {
    floor: kit.tex("concrete", 4),
    concrete: kit.tex("concrete", 4),
    concreteDark: kit.tex("concreteDark", 4),
    ceiling: kit.tex("concreteDark", 5),
    facade: kit.tex("facadeLight", 4),
    facadeDark: kit.tex("facadeDark", 4),
    paving: kit.tex("sidewalk", 3),
    grass: kit.tex("grass", 4),
    dirt: kit.tex("dirt", 4),
    stone: kit.tex("stone", 2),
    rubble: kit.tex("rubble", 3),
    rust: kit.tex("rust", 2),
    wood: kit.tex("wood", 1.5),
    bark: kit.tex("bark", 1.5),
    leaves: kit.tex("leaves", 3),
    solar: kit.tex("solar", 1),
    foliage: kit.card("foliage"),
    birchBark: painted(scene, "birchBark", 128, 1.2, drawBirchBark),
    birchLeaves: organic(scene, "birch-leaves", "#7f8c4a", "leaf"),
    steel: kit.flat("towerSteel", 0.42, 0.43, 0.42, 0.3),
    crane: kit.flat("craneYellow", 0.55, 0.45, 0.22, 0.15),
    brass: kit.flat("towerBrass", 0.42, 0.35, 0.2, 0.45),
    desk: kit.flat("officeDesk", 0.46, 0.42, 0.36, 0.08),
    chair: kit.flat("officeChair", 0.17, 0.18, 0.19, 0.05),
    duct: kit.flat("ductSteel", 0.55, 0.56, 0.55, 0.35),
    mullion: kit.flat("towerMullion", 0.25, 0.26, 0.26, 0.3),
    glass: glassMaterial(scene),
    marble: painted(scene, "lobbyMarble", 256, 3, drawMarble, 0.3),
    windows: painted(scene, "towerWindows", 256, 3.6, drawWindows, 0.25),
    carpet: painted(scene, "officeCarpet", 128, 2, drawCarpet),
    directory: signMaterial(scene, "lobbyDirectory", 256, drawDirectory),
    model: signMaterial(scene, "cityModelBase", 512, drawCityModel),
    modelWhite: kit.flat("modelCard", 0.86, 0.85, 0.8, 0.05),
    modelGrey: kit.flat("modelGrey", 0.62, 0.62, 0.6, 0.05),
  };
}

/** Dusty, dark glass: opaque, but with a sheen of the sky on it. */
function glassMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName("towerGlass");
  if (existing instanceof StandardMaterial) return existing;
  const mat = new StandardMaterial("towerGlass", scene);
  mat.diffuseTexture = paint(scene, "tex:towerGlass", 256, drawGlass, false, true);
  mat.specularColor = new Color3(0.55, 0.58, 0.6);
  mat.specularPower = 96;
  TILE_SIZES.set(mat, 3);
  return mat;
}

function signMaterial(scene: Scene, name: string, size: number, draw: (c: Ctx, s: number, r: () => number) => void): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const mat = new StandardMaterial(name, scene);
  mat.diffuseTexture = paint(scene, `tex:${name}`, size, draw, false, true);
  mat.specularColor = Color3.Black();
  return mat;
}

// --- Helpers ---------------------------------------------------------------------------

/** A horizontal slab with rectangular holes cut out. */
function slab(kit: Kit, name: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, holes: Hole[], material: StandardMaterial, opts: PieceOptions = {}): void {
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    const cut = holes.filter((h) => h.x0 < b && h.x1 > a).sort((p, q) => p.z0 - q.z0);
    let z = z0;
    for (const h of cut) {
      if (h.z0 > z) tiled(kit, name, a, b, y0, y1, z, Math.min(z1, h.z0), material, opts);
      z = Math.max(z, h.z1);
    }
    if (z < z1) tiled(kit, name, a, b, y0, y1, z, z1, material, opts);
  }
}

/** Stairs rising along z, from (z0, y0) to (z1, y1): a hidden ramp with visible steps on it. */
function stairsZ(kit: Kit, scene: Scene, name: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: StandardMaterial): void {
  const run = Math.abs(z1 - z0);
  const ramp = MeshBuilder.CreateBox(`${name}Ramp`, { width: x1 - x0, height: 0.2, depth: Math.hypot(run, y1 - y0) }, scene);
  const a = Math.atan2(y1 - y0, run);
  // Rising towards -z (or +z): tilt the ramp so its top face runs along the steps' front edges.
  const dir = Math.sign(z1 - z0);
  ramp.rotation.x = -dir * a;
  ramp.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 0.1 * Math.cos(a), (z0 + z1) / 2 + dir * 0.1 * Math.sin(a));
  ramp.isVisible = false;
  ramp.isPickable = false;
  ramp.checkCollisions = true;
  const steps = Math.ceil((y1 - y0) / 0.32);
  const rise = (y1 - y0) / steps;
  const step = (z1 - z0) / steps;
  for (let i = 0; i < steps; i++) {
    const top = y0 + (i + 1) * rise;
    const za = z0 + i * step;
    const zb = z0 + (i + 1) * step + dir * 0.05;
    kit.box(`${name}Step`, x0, x1, Math.max(y0 - 0.5, top - 1.2), top, Math.min(za, zb), Math.max(za, zb), material, { collide: false });
  }
}

/** A tree: tapered trunk and a crown of leaf blobs wrapped in cut-out leaf shells. */
function tree(kit: Kit, scene: Scene, m: Mats, r: () => number, x: number, y: number, z: number, height: number, birch: boolean, opts: { collide?: boolean } = {}): void {
  const trunk = MeshBuilder.CreateCylinder("plazaTrunk", { diameterTop: height * 0.025, diameterBottom: height * (birch ? 0.045 : 0.06), height, tessellation: 6 }, scene);
  trunk.position.set(x, y + height / 2, z);
  trunk.rotation.set((r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12);
  kit.add(trunk, birch ? m.birchBark : m.bark, { collide: opts.collide ?? true, tile: 1.5 });
  const blobs = birch ? 4 : 5;
  for (let k = 0; k < blobs; k++) {
    const s = height * (birch ? 0.22 + r() * 0.15 : 0.3 + r() * 0.2);
    const blob = MeshBuilder.CreateSphere("plazaCrown", { diameter: s, segments: 5 }, scene);
    blob.scaling.y = birch ? 1.2 : 0.75;
    blob.position.set(x + (r() - 0.5) * height * 0.25, y + height * (0.62 + r() * 0.35), z + (r() - 0.5) * height * 0.25);
    kit.add(blob, birch ? m.birchLeaves : m.leaves, { collide: false });
    const shell = MeshBuilder.CreateSphere("plazaShell", { diameter: 1, segments: 6 }, scene);
    shell.scaling.copyFrom(blob.scaling).scaleInPlace(s * 1.22);
    shell.position.copyFrom(blob.position);
    kit.add(shell, m.foliage, { collide: false, cast: false, tile: 1.6 });
  }
}

// --- Car park ---------------------------------------------------------------------------

function buildCarPark(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const cp = TOWER.carPark;
  const e = TOWER.corridorE;
  kit.box("carParkFloor", cp.x0, cp.x1, cp.floor - 1, cp.floor, cp.z0, cp.z1, m.floor, { cast: false });
  // Thick enough to meet the stairwell's wall, so there is no gap between them.
  kit.box("carParkWallW1", e.x1 + 0.4, cp.x0, cp.floor - 1, cp.ceiling, cp.z0, TOWER.carDoor.z0, m.concreteDark);
  kit.box("carParkWallW2", e.x1 + 0.4, cp.x0, cp.floor - 1, cp.ceiling, TOWER.carDoor.z1, cp.z1, m.concreteDark);
  kit.box("carParkDoorHead", e.x1 + 0.4, cp.x0, cp.floor + 2.6, cp.ceiling, TOWER.carDoor.z0, TOWER.carDoor.z1, m.concreteDark);
  kit.box("carParkWallE", cp.x1, cp.x1 + 0.4, cp.floor - 1, cp.ceiling, cp.z0 - 0.4, cp.z1 + 0.4, m.concreteDark);
  kit.box("carParkWallN", e.x1, cp.x1, cp.floor - 1, cp.ceiling, cp.z1, cp.z1 + 0.4, m.concreteDark);
  kit.box("carParkWallS", e.x1, cp.x1, cp.floor - 1, cp.ceiling, cp.z0 - 0.4, cp.z0, m.concreteDark);
  // Columns on a grid, with bay lines on the floor.
  for (let x = cp.x0 + 6; x < cp.x1 - 2; x += 8) for (let z = cp.z0 + 7; z < cp.z1 - 2; z += 7) {
    if (Math.abs(z - (TOWER.stairsG.z0 + TOWER.stairsG.z1) / 2) < 2.5 && x > TOWER.stairsG.x1 - 1 && x < TOWER.stairsG.x0 + 1) continue;
    kit.box("carParkColumn", x - 0.4, x + 0.4, cp.floor, cp.ceiling, z - 0.4, z + 0.4, m.concrete);
  }
  const lines = kit.flat("bayLine", 0.62, 0.6, 0.5);
  for (let x = cp.x0 + 2; x < cp.x1 - 2; x += 2.6) {
    kit.box("bayLine", x, x + 0.08, cp.floor, cp.floor + 0.01, cp.z0 + 0.5, cp.z0 + 5.2, lines, { collide: false, cast: false });
    kit.box("bayLine", x, x + 0.08, cp.floor, cp.floor + 0.01, cp.z1 - 5.2, cp.z1 - 0.5, lines, { collide: false, cast: false });
  }
  // Stairs up into the lobby, with a rail.
  const g = TOWER.stairsG;
  stairs(kit, scene, "lobbyStairs", g.x0, g.x1, g.z0, g.z1, cp.floor, L[0], m.concrete);
  kit.box("lobbyStairsWall", g.x1 - 0.4, g.x0, cp.floor, L[0] - 0.6, g.z0 - 0.3, g.z0, m.concreteDark, { cast: false });
  // Dead cars, in the bays, flat-tyred and silted up.
  for (const [x, z, yaw, tone] of [[584, -34, 0, 0], [592.5, -35, 0.08, 1], [610, -34.5, -0.05, 2], [621, -13, Math.PI, 1], [598, -13.5, Math.PI + 0.1, 0], [614, -12.8, Math.PI, 2]] as const) {
    car(kit, scene, m, r, x, cp.floor, z, yaw, tone);
  }
  // A ramp up to the street, filled in by the collapse; a little daylight still gets through.
  kit.slope("carRampRubble", new Vector3(cp.x1 - 3, cp.floor, cp.z1 - 6), new Vector3(cp.x1 - 3, cp.ceiling - 0.6, cp.z1 - 1), 5, 1.6, m.rubble, { cast: false });
  for (let i = 0; i < 18; i++) {
    const s = 0.2 + r() * 0.5;
    const rock = MeshBuilder.CreateBox("carParkRubble", { width: s * 1.5, height: s * 0.5, depth: s }, scene);
    rock.position.set(cp.x0 + 2 + r() * (cp.x1 - cp.x0 - 4), cp.floor + s * 0.2, cp.z0 + 2 + r() * (cp.z1 - cp.z0 - 4));
    rock.rotation.set(r() * 0.3, r() * 3, r() * 0.3);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }
  // Ducts under the car park ceiling (the Duct Vine has found these too).
  kit.box("carParkDuct", cp.x0, cp.x1 - 6, cp.ceiling - 0.75, cp.ceiling - 0.2, cp.z1 - 3.2, cp.z1 - 2.2, m.duct, { collide: false });
}

/** A small hatchback: body, cabin and wheels, under a skin of dust. */
function car(kit: Kit, scene: Scene, m: Mats, r: () => number, x: number, y: number, z: number, yaw: number, tone: number): void {
  const colours = [kit.flat("carBlue", 0.24, 0.3, 0.36, 0.2), kit.flat("carWhite", 0.62, 0.6, 0.56, 0.2), kit.flat("carRed", 0.42, 0.18, 0.15, 0.2)];
  const paintMat = colours[tone];
  const parts: [Mesh, StandardMaterial][] = [];
  const body = MeshBuilder.CreateBox("carBody", { width: 1.7, height: 0.7, depth: 3.9 }, scene);
  body.position.set(0, 0.55, 0);
  parts.push([body, paintMat]);
  const cabin = MeshBuilder.CreateBox("carCabin", { width: 1.5, height: 0.55, depth: 2.1 }, scene);
  cabin.position.set(0, 1.15, -0.2);
  parts.push([cabin, m.glass]);
  for (const [dx, dz] of [[-0.8, 1.2], [0.8, 1.2], [-0.8, -1.25], [0.8, -1.25]]) {
    const wheel = MeshBuilder.CreateCylinder("carWheel", { diameter: 0.55, height: 0.22, tessellation: 10 }, scene);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(dx, 0.22, dz);
    parts.push([wheel, m.chair]);
  }
  for (const [mesh, material] of parts) {
    mesh.rotation.y += yaw;
    mesh.position.set(x + mesh.position.x * Math.cos(yaw) + mesh.position.z * Math.sin(yaw), y + mesh.position.y - 0.08 * r(), z - mesh.position.x * Math.sin(yaw) + mesh.position.z * Math.cos(yaw));
    kit.add(mesh, material, { collide: material !== m.glass, tile: 1 });
  }
}

// --- Plaza floor and the tower's ground slab -------------------------------------------

function buildGround(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const p = TOWER.plaza;
  const t = TOWER.tower;
  const g = TOWER.stairsG;
  const G = L[0];
  // One slab over everything: the plaza, the lobby floor and the car park's ceiling.
  slab(kit, "groundSlab", p.x0, p.x1, p.z0, p.z1, TOWER.carPark.ceiling, G, [{ x0: g.x1, x1: g.x0, z0: g.z0, z1: g.z1 }], m.dirt, { cast: false });
  // Paved walks and kerbs across the plaza, half lost under the grass.
  const walks: Hole[] = [
    { x0: 590, x1: 602, z0: t.z1, z1: p.z1 },
    { x0: p.x0, x1: p.x1, z0: 8, z1: 20 },
    { x0: t.x1, x1: p.x1, z0: -30, z1: -24 },
    { x0: p.x0, x1: t.x0, z0: -20, z1: -10 },
  ];
  for (const w of walks) kit.box("plazaWalk", w.x0, w.x1, G, G + 0.02, w.z0, w.z1, m.paving, { collide: false, cast: false });
  // Patches of grass between, broken up so the paving shows through.
  for (let i = 0; i < 60; i++) {
    const x = p.x0 + 2 + r() * (p.x1 - p.x0 - 4);
    const z = p.z0 + 2 + r() * (p.z1 - p.z0 - 4);
    if (x > t.x0 - 1 && x < t.x1 + 1 && z > t.z0 - 1 && z < t.z1 + 1) continue;
    const w = 4 + r() * 8, d = 4 + r() * 8;
    kit.box("plazaGrass", x - w / 2, x + w / 2, G + 0.03, G + 0.035, z - d / 2, z + d / 2, m.grass, { collide: false, cast: false });
  }
  void scene;
}

// --- Lobby ------------------------------------------------------------------------------

function buildLobby(kit: Kit, scene: Scene, m: Mats, r: () => number): { revolvingDoor: Mesh[]; directory: Mesh[] } {
  const t = TOWER.tower;
  const G = L[0];
  const g = TOWER.stairsG;
  // Marble floor, cracked and drifted with leaves.
  slab(kit, "lobbyMarble", t.x0, t.x1, t.z0, t.z1, G, G + 0.02, [{ x0: g.x1, x1: g.x0, z0: g.z0, z1: g.z1 }], m.marble, { collide: false, cast: false });
  for (let i = 0; i < 40; i++) {
    const s = 0.3 + r() * 0.8;
    const leaf = MeshBuilder.CreateBox("lobbyLeafLitter", { width: s * 2, height: 0.04, depth: s }, scene);
    leaf.position.set(t.x0 + 1 + r() * (t.x1 - t.x0 - 2), G + 0.03, t.z1 - 1 - r() * 14 * r());
    leaf.rotation.y = r() * 3;
    kit.add(leaf, m.leaves, { collide: false, cast: false, tile: 1 });
  }
  // Rail around the stair opening.
  kit.box("stairsGRail", g.x1, g.x0, G, G + 1, g.z1, g.z1 + 0.1, m.steel, { cast: false });
  kit.box("stairsGRailE", g.x0, g.x0 + 0.1, G, G + 1, g.z0, g.z1 + 0.1, m.steel, { cast: false });
  // Columns: three in the atrium (to floor 3, one wrapped by the fig), the rest to floor 2.
  for (const x of [590, 596, 602]) {
    const top = L[2];
    const col = MeshBuilder.CreateCylinder("lobbyColumn", { diameter: 1.1, height: top - G, tessellation: 12 }, scene);
    col.position.set(x, (G + top) / 2, TOWER.figColumn.z);
    kit.add(col, m.marble, { tile: 2 });
  }
  for (const [x, z] of [[590, -22.5], [602, -22.5], [596, -28.5]]) {
    const col = MeshBuilder.CreateCylinder("lobbyColumn", { diameter: 1, height: L[1] - G, tessellation: 12 }, scene);
    col.position.set(x, (G + L[1]) / 2, z);
    kit.add(col, m.marble, { tile: 2 });
  }
  // Reception desk.
  kit.box("receptionDesk", 593, 599, G, G + 1.1, -21.2, -20.2, m.wood);
  kit.box("receptionTop", 592.9, 599.1, G + 1.1, G + 1.16, -21.3, -20.1, m.marble, { collide: false, tile: 2 });
  // Benches facing the glass.
  for (const x of [588, 604]) kit.box("lobbyBench", x - 1.2, x + 1.2, G, G + 0.45, -14.6, -14, m.wood);

  // The revolving door in the middle of the north front: a drum and four glass wings, stopped mid-turn.
  const door = new Form(scene, "revolvingDoor");
  const dx = 596, dz = t.z1, R = 1.6;
  door.lathe([[R, 0], [R, 0.06]], [dx, G, dz], m.brass, 18);
  door.lathe([[R, 2.6], [R, 2.9], [0, 2.9]], [dx, G, dz], m.brass, 18);
  // Curved glass sides (east and west halves of the drum), leaving the in and out openings.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const a = side * (Math.PI / 2) + ((i - 2) / 5) * (Math.PI / 2.4);
      const pane = door.box([dx + Math.sin(a) * R, G + 1.45, dz + Math.cos(a) * R], [0.62, 2.7, 0.04], m.glass);
      pane.rotation.y = a;
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = 0.35 + (k * Math.PI) / 2;
    const wing = door.box([dx + Math.sin(a) * R * 0.48, G + 1.4, dz + Math.cos(a) * R * 0.48], [0.05, 2.5, R * 0.95], m.glass);
    wing.rotation.y = a;
    // Brass frame along each wing's outer edge.
    const edge = door.box([dx + Math.sin(a) * R * 0.95, G + 1.4, dz + Math.cos(a) * R * 0.95], [0.07, 2.55, 0.07], m.brass);
    edge.rotation.y = a;
  }
  door.taper([[dx, G, dz], [dx, G + 2.9, dz]], 0.06, 0.06, m.brass, 8);
  const revolvingDoor = door.finish();
  for (const part of revolvingDoor) kit.add(part, part.material as StandardMaterial, { keep: true, tile: undefined });
  // An invisible drum so the robot walks around it, through the broken panes beside it.
  kit.box("revolvingDoorCollider", dx - R, dx + R, G, G + 2.9, dz - R, dz + R, m.brass, { hidden: true, cast: false });

  // The directory board on the lift wall, beside the lift doors.
  const lift = TOWER.lift;
  const board = MeshBuilder.CreateBox("lobbyDirectory", { width: 0.12, height: 2.2, depth: 2.6 }, scene);
  board.position.set(lift.x1 + 0.06, G + 1.9, lift.z1 + 1.8);
  const directory = [kit.add(board, m.directory, { keep: true, collide: false })];
  kit.box("directoryFrame", lift.x1, lift.x1 + 0.1, G + 0.75, G + 3.05, lift.z1 + 0.45, lift.z1 + 3.15, m.brass, { collide: false });
  return { revolvingDoor, directory };
}

// --- Upper floors -----------------------------------------------------------------------

/** Where the leaning slabs go: from floor `i` up to `i + 1`, which lane and which way. */
function bayRamp(i: number): { lane: { x0: number; x1: number }; z0: number; z1: number } {
  const b = TOWER.bay;
  if (i === 0) return { lane: b.laneA, z0: -31, z1: -17.5 };
  // From odd floors the slabs climb south in lane B, from even floors north in lane A,
  // so the top of one is beside the foot of the next.
  return i % 2 === 1 ? { lane: b.laneB, z0: -17, z1: -24.5 } : { lane: b.laneA, z0: -24.5, z1: -17 };
}

function coreLane(i: number): { z0: number; z1: number; up: "east" | "west" } | undefined {
  // Floor 6 (index 5) to floor 7, floor 7 to 8, and floor 8 to the roof.
  if (i < 5 || i > 7) return undefined;
  const c = TOWER.core;
  return i % 2 === 1 ? { ...c.lane1, up: "east" } : { ...c.lane2, up: "west" };
}

function buildFloors(kit: Kit, scene: Scene, m: Mats, r: () => number): { ducts: { from: Vector3; to: Vector3; burst: boolean }[]; desks: Vector3[]; ledges: Vector3[] } {
  const t = TOWER.tower;
  const ducts: { from: Vector3; to: Vector3; burst: boolean }[] = [];
  const desks: Vector3[] = [];
  const ledges: Vector3[] = [];
  const lean = (i: number) => {
    const ramp = bayRamp(i);
    const lx = (ramp.lane.x0 + ramp.lane.x1) / 2;
    kit.slope("fallenSlab", new Vector3(lx, L[i], ramp.z0), new Vector3(lx, L[i + 1] + 0.02, ramp.z1 + Math.sign(ramp.z1 - ramp.z0) * 0.25), ramp.lane.x1 - ramp.lane.x0, 0.35, m.concrete);
  };
  lean(0);
  for (let i = 1; i < L.length; i++) {
    const y = L[i];
    const holes: Hole[] = [];
    // The hole the slab from the floor below leans up through.
    // (It ends exactly at the slab's edge on its high end.)
    const below = bayRamp(i - 1);
    const north = below.z1 > below.z0;
    holes.push({ x0: below.lane.x0 - 0.2, x1: below.lane.x1 + 0.2, z0: north ? below.z0 - 0.3 : below.z1, z1: north ? below.z1 : below.z0 + 0.3 });
    if (i === 1) holes.push(TOWER.atrium);
    // On floor 4 the lift car shows through the open doors.
    if (i === 3) holes.push(TOWER.lift);
    const stair = coreLane(i - 1);
    if (stair) holes.push({ x0: TOWER.core.x0 - 0.3, x1: TOWER.core.x1 + 0.1, z0: stair.z0, z1: stair.z1 });
    const roof = i === L.length - 1;
    slab(kit, roof ? "roofSlab" : "floorSlab", t.x0, t.x1, t.z0, t.z1, y - 0.45, y, holes, roof ? m.concrete : m.concrete);
    if (!roof) slab(kit, "officeCarpet", t.x0 + 0.3, TOWER.bay.x0, t.z0 + 0.3, t.z1 - 0.3, y, y + 0.015, holes, m.carpet, { collide: false, cast: false });
    // Ragged east edge: chunks broken off and hanging, rebar sticking out.
    for (let k = 0; k < 6; k++) {
      const z = t.z0 + 1 + r() * (t.z1 - t.z0 - 2);
      const chunk = MeshBuilder.CreateBox("slabChunk", { width: 1.2 + r(), height: 0.45, depth: 1 + r() * 1.5 }, scene);
      chunk.position.set(t.x1 + 0.3, y - 0.5 - r() * 0.4, z);
      chunk.rotation.set(r() * 0.4, r() * 0.3, -0.5 - r() * 0.6);
      kit.add(chunk, m.concrete, { collide: false, tile: 2 });
      for (let j = 0; j < 3; j++) kit.box("rebar", t.x1, t.x1 + 0.6 + r() * 0.8, y - 0.3, y - 0.26, z - 1.5 + j * 0.6, z - 1.46 + j * 0.6, m.rust, { collide: false, cast: false });
    }
    if (roof) continue;
    // The slab leaning up from this floor to the next, in the split east bay.
    lean(i);
    // Office furniture on each floor: rows of desks, some knocked over.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      if (r() < 0.25) continue;
      const x = 588 + col * 4.8 + (r() - 0.5) * 0.6;
      const z = -33 + row * 6.5 + (r() - 0.5) * 0.6;
      if (i >= 5 && z > -24 && z < -16 && x > TOWER.core.x0 - 1.5 && x < TOWER.core.x1 + 1.5) continue;
      if (x < TOWER.lift.x1 + 1.2 && z > TOWER.lift.z0 - 1 && z < TOWER.lift.z1 + 1) continue;
      if (i === 7 && z > TOWER.boardRoom.z0 - 1) continue;
      if (r() < 0.2) {
        const desk = MeshBuilder.CreateBox("toppledDesk", { width: 1.6, height: 0.05, depth: 0.8 }, scene);
        desk.position.set(x, y + 0.42, z);
        desk.rotation.set(Math.PI / 2 - 0.3, r() * 3, 0);
        kit.add(desk, m.desk, { collide: false, tile: 1 });
        continue;
      }
      kit.box("officeDesk", x - 0.8, x + 0.8, y + 0.72, y + 0.76, z - 0.4, z + 0.4, m.desk);
      for (const sx of [-0.7, 0.7]) kit.box("deskLeg", x + sx - 0.03, x + sx + 0.03, y, y + 0.72, z - 0.35, z + 0.35, m.steel, { collide: false, cast: false });
      if (r() < 0.6) kit.box("officeChair", x - 0.25, x + 0.25, y, y + 0.48, z + 0.55, z + 1.05, m.chair, { collide: false });
    }
    // A desk the Window Birch grows through, on floors 3 and 5 (the tree comes from the life code).
    if (i === 2 || i === 4) {
      const x = i === 2 ? 605.5 : 603.2, z = i === 2 ? -27 : -12.5;
      for (const side of [-1, 1]) {
        // Split in two, the halves tipped apart.
        const half = MeshBuilder.CreateBox("splitDesk", { width: 0.78, height: 0.05, depth: 0.8 }, scene);
        half.position.set(x + side * 0.42, y + 0.74, z);
        half.rotation.z = side * 0.18;
        kit.add(half, m.desk, { collide: false, tile: 1 });
        kit.box("deskLeg", x + side * 0.72 - 0.03, x + side * 0.72 + 0.03, y, y + 0.7, z - 0.35, z + 0.35, m.steel, { collide: false, cast: false });
      }
      kit.box("splitDeskCollider", x - 0.8, x + 0.8, y, y + 0.76, z - 0.4, z + 0.4, m.desk, { hidden: true, cast: false });
      desks.push(new Vector3(x, y, z));
    }
    // Air ducts under the ceiling, running east-west. On floor 5 (index 4) one has burst open.
    if (i >= 1 && i <= 5) {
      const top = L[i + 1] - 0.45;
      for (const z of i % 2 ? [-30.5] : [-19.5]) {
        const x0 = t.x0 + 3.5, x1 = TOWER.bay.x0 + 3;
        const burst = i === 4;
        if (burst) {
          // Burst along its seam: the two halves bent apart for a few metres.
          const mid = 603;
          kit.box("airDuct", x0, mid - 2.2, top - 0.7, top - 0.15, z - 0.45, z + 0.45, m.duct, { collide: false });
          kit.box("airDuct", mid + 2.2, x1, top - 0.7, top - 0.15, z - 0.45, z + 0.45, m.duct, { collide: false });
          for (const side of [-1, 1]) {
            const half = MeshBuilder.CreateBox("burstDuct", { width: 4.4, height: 0.04, depth: 0.95 }, scene);
            half.position.set(mid, top - 0.42 + side * 0.32, z + side * 0.28);
            half.rotation.x = side * 0.7;
            kit.add(half, m.duct, { collide: false, tile: 1 });
          }
        } else {
          kit.box("airDuct", x0, x1, top - 0.7, top - 0.15, z - 0.45, z + 0.45, m.duct, { collide: false });
        }
        for (let x = x0 + 2; x < x1; x += 4) kit.box("ductHanger", x, x + 0.04, top - 0.7, top, z - 0.5, z - 0.46, m.steel, { collide: false, cast: false });
        ducts.push({ from: new Vector3(x0, top - 0.42, z), to: new Vector3(x1, top - 0.42, z), burst });
      }
    }
    // Swallows' ledges: under the spandrels outside the north front, on floors 2 and 3.
    if (i === 1 || i === 2) for (const x of [588.5, 593, 599.5, 604]) ledges.push(new Vector3(x + (r() - 0.5), y - 0.8, t.z1 + 0.45));
  }
  return { ducts, desks, ledges };
}

/** Curtain walls on the north, west and south fronts. The east front is gone. */
function buildFacades(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const t = TOWER.tower;
  const crane = TOWER.crane.to;
  const sides: { axis: "x" | "z"; at: number; from: number; to: number; out: number }[] = [
    { axis: "z", at: t.z1, from: t.x0, to: t.x1 - 2, out: 1 },
    { axis: "z", at: t.z0, from: t.x0, to: t.x1 - 2, out: -1 },
    { axis: "x", at: t.x0, from: t.z0, to: t.z1, out: -1 },
  ];
  const wall = (name: string, side: (typeof sides)[number], a: number, b: number, y0: number, y1: number, depth: number, material: StandardMaterial, opts: PieceOptions = {}) => {
    const o = side.at + side.out * depth;
    const lo = Math.min(side.at, o), hi = Math.max(side.at, o);
    if (side.axis === "z") tiled(kit, name, a, b, y0, y1, lo, hi, material, opts);
    else tiled(kit, name, lo, hi, y0, y1, a, b, material, opts);
  };
  for (const side of sides) {
    for (let i = 0; i < L.length - 1; i++) {
      const y = L[i];
      const top = L[i + 1] - 0.45;
      // The crane broke through the west front on floor 6: no parapet, no glass there.
      const breach = side.axis === "x" && i === 5 ? { a: crane.z - 3.5, b: crane.z + 3.5 } : undefined;
      if (i > 0) {
        // Spandrel band: the slab edge and a parapet the robot can't step over.
        const segs = breach ? [[side.from, breach.a], [breach.b, side.to]] : [[side.from, side.to]];
        for (const [a, b] of segs) {
          wall("spandrel", side, a, b, y - 0.6, y + 1.1, 0.3, m.facadeDark);
        }
      }
      // Glass in 3 m bays between mullions; more panes are missing towards the split east side.
      const span = side.to - side.from;
      const bays = Math.round(span / 3);
      const w = span / bays;
      for (let k = 0; k < bays; k++) {
        const a = side.from + k * w, b = a + w;
        wall("mullion", side, a - 0.06, a + 0.06, i === 0 ? y : y + 1.1, top, 0.2, m.mullion, { collide: false });
        if (breach && b > breach.a && a < breach.b) continue;
        const east = side.axis === "z" ? (a - t.x0) / (t.x1 - t.x0) : 0.2;
        if (r() < 0.15 + east * 0.45) continue;
        // The lobby's panes either side of the revolving door are broken, the way in.
        if (i === 0 && side.out === 1 && a < 597.6 && b > 594.4) continue;
        wall("facadeGlass", side, a + 0.06, b - 0.06, i === 0 ? y : y + 1.1, top, 0.1, m.glass, i === 0 ? {} : { collide: true });
      }
      if (i === 0) wall("lobbyTransom", side, side.from, side.to, top - 0.6, top + 0.45, 0.3, m.facadeDark, { collide: false });
    }
    // The last mullion at the far end.
    wall("mullion", side, side.to - 0.06, side.to + 0.06, L[0], L[L.length - 1] - 0.45, 0.2, m.mullion, { collide: false });
  }
  // The east front: a few bent mullions hanging off the slab edges, and the lobby's east wall half collapsed.
  for (let i = 1; i < L.length - 1; i++) {
    for (let k = 0; k < 3; k++) {
      const z = t.z0 + 2 + r() * (t.z1 - t.z0 - 4);
      const bar = MeshBuilder.CreateBox("hangingMullion", { width: 0.12, height: 2 + r() * 2, depth: 0.12 }, scene);
      bar.position.set(t.x1 + 0.4, L[i] - 1.3, z);
      bar.rotation.set(r() * 0.4, 0, 0.3 + r() * 0.5);
      kit.add(bar, m.mullion, { collide: false, tile: 1 });
    }
  }
  kit.box("lobbyEastWall", t.x1 - 0.3, t.x1, L[0], L[0] + 1.1, t.z0, -31.5, m.facadeDark);
  kit.box("lobbyEastWall", t.x1 - 0.3, t.x1, L[0], L[0] + 1.1, -14, t.z1, m.facadeDark);
  for (let i = 0; i < 14; i++) {
    const s = 0.4 + r() * 0.9;
    const rock = MeshBuilder.CreateBox("eastRubble", { width: s * 1.6, height: s * 0.6, depth: s }, scene);
    rock.position.set(t.x1 + 0.5 + r() * 4, L[0] + s * 0.25, t.z0 + 4 + r() * 20);
    rock.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
    kit.add(rock, m.rubble, { collide: false, tile: 1 });
  }
}

/** The stairs inside from floor 6 to the roof, the walls around them and the hut over the top. */
function buildCore(kit: Kit, scene: Scene, m: Mats): void {
  const c = TOWER.core;
  for (let i = 5; i <= 7; i++) {
    const lane = coreLane(i)!;
    if (lane.up === "east") stairs(kit, scene, "coreStairs", c.x0, c.x1, lane.z0, lane.z1, L[i], L[i + 1], m.concrete);
    else stairs(kit, scene, "coreStairs", c.x1, c.x0, lane.z0, lane.z1, L[i], L[i + 1], m.concrete);
    // Walls along the stairwell's sides (open at both ends).
    tiled(kit, "coreWall", c.x0 - 0.5, c.x1 + 0.6, L[i], L[i + 1] - 0.45, c.lane1.z0 - 0.35, c.lane1.z0, m.facade);
    if (i < 7) tiled(kit, "coreWall", c.x0 - 0.5, c.x1 + 0.6, L[i], L[i + 1] - 0.45, c.lane2.z1, c.lane2.z1 + 0.35, m.facade);
  }
  // Between floors 1 and 6 the stairwell is choked with rubble.
  for (let i = 1; i < 5; i++) kit.box("coreRubble", c.x0 - 0.5, c.x1 + 0.6, L[i], L[i] + 1.6, c.lane1.z0, c.lane2.z1, m.rubble);
  // The hut on the roof over the top flight, open to the east.
  const top = L[8];
  tiled(kit, "stairHut", c.x0 - 0.8, c.x1 + 0.4, top, top + 2.8, c.lane1.z0 - 0.35, c.lane1.z0, m.facade);
  tiled(kit, "stairHut", c.x0 - 0.8, c.x1 + 0.4, top, top + 2.8, c.lane1.z1, c.lane1.z1 + 0.35, m.facade);
  tiled(kit, "stairHut", c.x0 - 0.8, c.x0 - 0.45, top, top + 2.8, c.lane1.z0, c.lane1.z1, m.facade);
  tiled(kit, "stairHutRoof", c.x0 - 1, c.x1 + 0.6, top + 2.8, top + 3.1, c.lane1.z0 - 0.5, c.lane1.z1 + 0.5, m.concreteDark);
}

/** The lift shaft by the west wall; on floor 4 its doors are forced open on a car stopped between floors. */
function buildElevator(kit: Kit, scene: Scene, m: Mats): Mesh[] {
  const lf = TOWER.lift;
  const y4 = L[3];
  const carFloor = y4 - 1.2;
  tiled(kit, "liftShaft", lf.x0, lf.x1, L[0], carFloor - 0.3, lf.z0, lf.z1, m.facade);
  tiled(kit, "liftShaft", lf.x0, lf.x1, y4 + 2.6, L[8] + 1, lf.z0, lf.z1, m.facade);
  tiled(kit, "liftShaftW", lf.x0, lf.x0 + 0.3, carFloor - 0.3, y4 + 2.6, lf.z0, lf.z1, m.facade);
  tiled(kit, "liftShaftS", lf.x0, lf.x1, carFloor - 0.3, y4 + 2.6, lf.z0, lf.z0 + 0.3, m.facade);
  tiled(kit, "liftShaftN", lf.x0, lf.x1, carFloor - 0.3, y4 + 2.6, lf.z1 - 0.3, lf.z1, m.facade);
  // Door wall on floor 4: two openings, one with its doors prised apart.
  tiled(kit, "liftDoorWall", lf.x1 - 0.2, lf.x1, y4 - 0.45, y4 + 2.6, lf.z0 + 0.3, lf.z0 + 1, m.facade);
  tiled(kit, "liftDoorWall", lf.x1 - 0.2, lf.x1, y4 - 0.45, y4 + 2.6, lf.z0 + 3, lf.z1 - 0.3, m.facade);
  tiled(kit, "liftDoorHead", lf.x1 - 0.2, lf.x1, y4 + 2.2, y4 + 2.6, lf.z0 + 1, lf.z0 + 3, m.facade);
  const f = new Form(scene, "elevatorCar");
  const panel = kit.flat("liftPanel", 0.5, 0.48, 0.44, 0.4);
  const cz = (lf.z0 + 0.3 + lf.z0 + 3.4) / 2;
  // The car: floor, back and sides, roof, a little below the landing.
  f.box([(lf.x0 + lf.x1) / 2, carFloor - 0.05, cz], [2.4, 0.1, 2.8], m.steel);
  f.box([lf.x0 + 0.38, carFloor + 1.15, cz], [0.06, 2.3, 2.8], panel);
  for (const s of [-1, 1]) f.box([(lf.x0 + lf.x1) / 2, carFloor + 1.15, cz + s * 1.4], [2.4, 2.3, 0.06], panel);
  f.box([(lf.x0 + lf.x1) / 2, carFloor + 2.3, cz], [2.4, 0.1, 2.8], m.steel);
  // Floor buttons beside the door, the top one rubbed shiny.
  f.box([lf.x1 - 0.32, carFloor + 1.2, cz + 1.3], [0.04, 0.7, 0.18], m.steel);
  for (let k = 0; k < 8; k++) f.box([lf.x1 - 0.3, carFloor + 0.92 + k * 0.08, cz + 1.3], [0.03, 0.04, 0.06], k === 7 ? m.brass : m.chair);
  // The landing doors, forced back into their pockets, one bent.
  const door = f.box([lf.x1 - 0.12, y4 + 1.1, lf.z0 + 0.75], [0.05, 2.2, 0.55], m.steel);
  door.rotation.y = 0.25;
  f.box([lf.x1 - 0.12, y4 + 1.1, lf.z0 + 3.2], [0.05, 2.2, 0.45], m.steel);
  const parts = f.finish();
  for (const part of parts) kit.add(part, part.material as StandardMaterial, { keep: true, tile: undefined });
  // Something to stand on, to climb back out.
  kit.box("liftCarStep", lf.x0 + 0.5, lf.x0 + 1.4, carFloor, carFloor + 0.6, cz - 0.6, cz + 0.6, m.rubble);
  // Lobby: closed lift doors.
  for (const z of [lf.z0 + 1.5, lf.z0 + 4.4]) kit.box("liftDoorsLobby", lf.x1, lf.x1 + 0.06, L[0], L[0] + 2.3, z - 1, z + 1, m.steel, { collide: false });
  return parts;
}

/** The board room on floor 8: a long table, chairs, and the model of the city. */
function buildBoardRoom(kit: Kit, scene: Scene, m: Mats, r: () => number): Mesh[] {
  const b = TOWER.boardRoom;
  const y = L[7];
  const top = L[8] - 0.45;
  tiled(kit, "boardRoomWallS", b.x0, 595, y, top, b.z0 - 0.25, b.z0, m.facade);
  tiled(kit, "boardRoomWallS", 597.2, b.x1, y, top, b.z0 - 0.25, b.z0, m.facade);
  tiled(kit, "boardRoomDoorHead", 595, 597.2, y + 2.3, top, b.z0 - 0.25, b.z0, m.facade);
  tiled(kit, "boardRoomWallE", b.x1, b.x1 + 0.25, y, top, b.z0 - 0.25, b.z1, m.facade);
  kit.box("boardRoomCarpet", b.x0 + 0.3, b.x1, y + 0.016, y + 0.03, b.z0, b.z1 - 0.3, kit.flat("boardCarpet", 0.24, 0.25, 0.27), { collide: false, cast: false });
  // The table and its chairs.
  const tx0 = 587.5, tx1 = 602.5, tz0 = -13.4, tz1 = -10.6;
  kit.box("boardTable", tx0, tx1, y + 0.7, y + 0.78, tz0, tz1, m.wood);
  for (const x of [tx0 + 1, (tx0 + tx1) / 2, tx1 - 1]) kit.box("boardTableLeg", x - 0.3, x + 0.3, y, y + 0.7, -12.3, -11.7, m.wood);
  for (let x = tx0 + 1; x < tx1; x += 1.6) for (const z of [tz0 - 0.6, tz1 + 0.6]) {
    if (r() < 0.15) continue;
    kit.box("boardChair", x - 0.28, x + 0.28, y, y + 0.5, z - 0.28, z + 0.28, m.chair, { collide: false });
    kit.box("boardChairBack", x - 0.28, x + 0.28, y + 0.5, y + 1.1, z + Math.sign(z + 12) * 0.2, z + Math.sign(z + 12) * 0.28, m.chair, { collide: false });
  }
  // Water glasses along the edges.
  const glassMat = kit.flat("waterGlass", 0.6, 0.65, 0.66, 0.6);
  for (let x = tx0 + 1; x < tx1; x += 1.6) for (const z of [tz0 + 0.2, tz1 - 0.2]) {
    const g = MeshBuilder.CreateCylinder("waterGlass", { diameter: 0.07, height: 0.12, tessellation: 6 }, scene);
    g.position.set(x, y + 0.84, z);
    kit.add(g, glassMat, { collide: false, cast: false });
  }
  // The city model, on a base over the middle of the table.
  const f = new Form(scene, "cityModel");
  const mx = (tx0 + tx1) / 2, mz = (tz0 + tz1) / 2, my = y + 0.78;
  const base = f.box([mx, my + 0.03, mz], [9, 0.06, 2.4], m.model);
  base.rotation.y = 0;
  // Blocks for buildings inland (the base's painted map has the coast along its north edge).
  for (let i = 0; i < 70; i++) {
    const bx = mx - 4.2 + r() * 8.4;
    const bz = mz - 1.05 + r() * 1.4;
    const tall = bx > mx + 1.5 && bx < mx + 3.2 ? 0.25 + r() * 0.35 : 0.03 + r() * 0.08;
    f.box([bx, my + 0.06 + tall / 2, bz], [0.08 + r() * 0.1, tall, 0.08 + r() * 0.1], r() < 0.7 ? m.modelWhite : m.modelGrey);
  }
  // The sea wall along the coast in white card, glued down... except the last section, lying loose beside it.
  const wallZ = mz + 0.62;
  for (let k = 0; k < 7; k++) {
    const x0 = mx - 4.3 + k * 1.15;
    const seg = f.box([x0 + 0.5, my + 0.1, wallZ + Math.sin(k * 0.9) * 0.06], [1.1, 0.08, 0.03], m.modelWhite);
    seg.rotation.y = Math.sin(k) * 0.08;
  }
  const loose = f.box([mx + 4.1, my + 0.065, mz + 1.45], [1.1, 0.012, 0.08], m.modelWhite);
  loose.rotation.y = 0.35;
  const parts = f.finish();
  for (const part of parts) kit.add(part, part.material as StandardMaterial, { keep: true, collide: false, tile: undefined });
  return parts;
}

/** The tower's upper shaft above the roof terrace: sealed, glazed, streaked with green. */
function buildShaft(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const s = TOWER.shaft;
  const y0 = L[8];
  tiled(kit, "towerShaft", s.x0, s.x1, y0, s.top, s.z0, s.z1, m.windows, { cast: false });
  tiled(kit, "towerShaftCrown", s.x0 - 0.4, s.x1 + 0.4, s.top, s.top + 2.5, s.z0 - 0.4, s.z1 + 0.4, m.facadeDark, { cast: false, collide: false });
  // Corner piers and setbacks, so it isn't a plain box.
  for (const [x, z] of [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]]) tiled(kit, "shaftPier", x - 0.5, x + 0.5, y0, s.top + 1, z - 0.5, z + 0.5, m.facadeDark, { cast: false, collide: false });
  // A wild roof garden on top, trees leaning over the edge.
  for (let i = 0; i < 6; i++) {
    const blob = MeshBuilder.CreateSphere("shaftGarden", { diameter: 4 + r() * 4, segments: 5 }, scene);
    blob.scaling.y = 0.6;
    blob.position.set(s.x0 + 2 + r() * (s.x1 - s.x0 - 4), s.top + 2.5 + r(), s.z0 + 2 + r() * (s.z1 - s.z0 - 4));
    kit.add(blob, m.leaves, { collide: false, cast: false });
  }
  // Vines hanging down the north face of the shaft.
  const vine = card(scene, "vine");
  const strips: Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const len = 8 + r() * 30;
    const p = MeshBuilder.CreatePlane("shaftVine", { width: 2 + r() * 2, height: len }, scene);
    const face = i % 3;
    if (face === 0) { p.position.set(s.x0 + 2 + r() * (s.x1 - s.x0 - 4), s.top - len / 2, s.z1 + 0.06); }
    else if (face === 1) { p.position.set(s.x1 + 0.06, s.top - len / 2, s.z0 + 1 + r() * (s.z1 - s.z0 - 2)); p.rotation.y = Math.PI / 2; }
    else { p.position.set(s.x0 + 2 + r() * (s.x1 - s.x0 - 4), y0 + len / 2, s.z1 + 0.06); }
    p.bakeCurrentTransformIntoVertices();
    strips.push(p);
  }
  const vines = Mesh.MergeMeshes(strips, true)!;
  vines.name = "towerVines";
  vines.material = vine;
  vines.isPickable = false;
  vines.freezeWorldMatrix();
}

/** The tower crane: its mast fell across the plaza and its boom leans on the west front, a way up to floor 6. */
function buildCrane(kit: Kit, m: Mats, r: () => number): void {
  const { from, to } = TOWER.crane;
  // Walkway on top of the boom, from the plaza floor to the slab's edge.
  const w0 = new Vector3(from.x - 1, from.y + 0.05, from.z), w1 = to.add(new Vector3(0.6, 0, 0));
  kit.slope("craneWalk", w0, w1, 1.5, 0.12, m.rust);
  // The boom's lattice under it: four chords and zig-zag bracing.
  const dir = w1.subtract(w0);
  const len = dir.length();
  const along = dir.normalizeToNew();
  const side = new Vector3(0, 0, 1);
  const up = Vector3.Cross(along, side).scaleInPlace(-1);
  const chord = (a: Vector3, b: Vector3, w: number) => kit.slope("craneLattice", a, b, w, w, m.crane, { collide: false });
  const offsets: [number, number][] = [[0.7, -0.25], [-0.7, -0.25], [0.7, -1.65], [-0.7, -1.65]];
  for (const [s, u] of offsets) chord(w0.add(side.scale(s)).add(up.scale(u)), w1.add(side.scale(s)).add(up.scale(u)), 0.14);
  for (let k = 0; k < len - 1.5; k += 1.5) {
    const a = w0.add(along.scale(k)), b = w0.add(along.scale(k + 1.5));
    for (const s of [0.7, -0.7]) chord(a.add(side.scale(s)).add(up.scale(-0.25)), b.add(side.scale(s)).add(up.scale(-1.65)), 0.07);
    chord(a.add(side.scale(0.7)).add(up.scale(-1.65)), a.add(side.scale(-0.7)).add(up.scale(-1.65)), 0.07);
  }
  // Rails on both sides of the walkway, broken in places.
  for (const s of [0.75, -0.75]) {
    for (let k = 2; k < len - 3; k += 6) {
      if (r() < 0.3) continue;
      chord(w0.add(along.scale(k)).add(side.scale(s)).add(up.scale(1)), w0.add(along.scale(k + 5)).add(side.scale(s)).add(up.scale(1)), 0.05);
    }
  }
  // The foot of the boom: the crushed cab and the fallen mast across the plaza.
  const G = L[0];
  kit.box("craneCab", from.x - 4, from.x - 0.5, G, G + 2.4, from.z + 2, from.z + 5, m.crane);
  kit.box("craneCabGlass", from.x - 3.9, from.x - 0.4, G + 1.3, G + 2.2, from.z + 2.1, from.z + 5.1, m.glass, { collide: false });
  kit.box("craneCounterweight", from.x - 10, from.x - 4.5, G, G + 1.8, from.z + 1.5, from.z + 5, m.concreteDark);
  for (let k = 0; k < 6; k++) {
    const z0 = from.z + 4 + k * 4;
    kit.box("craneMast", from.x - 2.6 + k * 0.4, from.x - 0.6 + k * 0.4, G, G + 1.9, z0, z0 + 4, m.crane, { cast: true });
  }
}

/** Planted roof terrace: overgrown planters, young trees, a low parapet. */
function buildTerrace(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const t = TOWER.tower;
  const s = TOWER.shaft;
  const y = L[8];
  // Parapet around the roof's open edges, with a gap at the east where the slab broke away.
  kit.box("terraceParapetN", t.x0, t.x1, y, y + 0.9, t.z1 - 0.3, t.z1, m.facadeDark);
  kit.box("terraceParapetW", t.x0, t.x0 + 0.3, y, y + 0.9, s.z1, t.z1, m.facadeDark);
  kit.box("terraceParapetS", s.x1, t.x1, y, y + 0.9, t.z0, t.z0 + 0.3, m.facadeDark);
  // (Broken away where the slabs lean up from below, and where the Predecessor sits.)
  kit.box("terraceParapetE", t.x1 - 0.3, t.x1, y, y + 0.9, t.z0, -32, m.facadeDark);
  kit.box("terraceParapetE", t.x1 - 0.3, t.x1, y, y + 0.9, -28, -24.8, m.facadeDark);
  kit.box("terraceParapetE", t.x1 - 0.3, t.x1, y, y + 0.9, -16.8, t.z1, m.facadeDark);
  // Planters full of soil, grass and trees; decking between.
  kit.box("terraceDeck", t.x0 + 0.3, t.x1 - 0.3, y, y + 0.05, s.z1, t.z1 - 0.3, m.wood, { collide: false, cast: false });
  const planters: [number, number, number, number][] = [[586, 596, -12, -9], [600, 607, -12.5, -9], [586, 589, -22, -14.5], [608.5, 611, -34.5, -27]];
  for (const [x0, x1, z0, z1] of planters) {
    kit.box("planter", x0, x1, y, y + 0.55, z0, z1, m.concreteDark);
    kit.box("planterSoil", x0 + 0.15, x1 - 0.15, y + 0.55, y + 0.6, z0 + 0.15, z1 - 0.15, m.dirt, { collide: false });
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    tree(kit, scene, m, r, cx + (r() - 0.5) * 2, y + 0.55, cz, 3.5 + r() * 2.5, r() < 0.6);
  }
  // The terrace's wild edge: grass mounds where soil has blown in.
  for (let i = 0; i < 5; i++) {
    const mound = MeshBuilder.CreateSphere("terraceMound", { diameter: 1, segments: 6 }, scene);
    mound.scaling.set(3 + r() * 3, 0.5, 2 + r() * 2);
    mound.position.set(t.x0 + 4 + r() * 28, y, -23 + r() * 10);
    kit.add(mound, m.grass, { collide: false, cast: false, tile: 2 });
  }
}

// --- The plaza forest and the buildings around it -----------------------------------------

function buildPlaza(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const p = TOWER.plaza;
  const t = TOWER.tower;
  const G = L[0];
  const f = TOWER.fountain;
  // The dry fountain: a round basin, a low centre, leaves in the bottom.
  const basin = MeshBuilder.CreateTorus("fountainRim", { diameter: 9, thickness: 0.7, tessellation: 24 }, scene);
  basin.position.set(f.x, G + 0.35, f.z);
  basin.scaling.y = 1.1;
  kit.add(basin, m.stone, { tile: 2 });
  kit.box("fountainBed", f.x - 3.3, f.x + 3.3, G, G + 0.1, f.z - 3.3, f.z + 3.3, m.dirt, { collide: false, cast: false });
  const centre = MeshBuilder.CreateCylinder("fountainCentre", { diameterTop: 1.2, diameterBottom: 1.6, height: 1.4, tessellation: 12 }, scene);
  centre.position.set(f.x, G + 0.7, f.z);
  kit.add(centre, m.stone, { tile: 2 });
  // Benches around it and along the walks.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const bench = MeshBuilder.CreateBox("plazaBench", { width: 2.2, height: 0.45, depth: 0.6 }, scene);
    bench.position.set(f.x + Math.cos(a) * 7.5, G + 0.22, f.z + Math.sin(a) * 7.5);
    bench.rotation.y = -a + Math.PI / 2;
    kit.add(bench, m.wood, { tile: 1 });
  }
  // Square planters along the tower front, cracked open by the trees.
  for (const x of [570, 580, 612, 622, 632]) kit.box("plazaPlanter", x - 1.5, x + 1.5, G, G + 0.6, -5, -2, m.concreteDark);
  // Lamp posts, some leaning.
  for (let i = 0; i < 10; i++) {
    const x = p.x0 + 10 + r() * (p.x1 - p.x0 - 20), z = -2 + r() * 44;
    const post = MeshBuilder.CreateCylinder("lampPost", { diameterTop: 0.1, diameterBottom: 0.16, height: 5, tessellation: 6 }, scene);
    post.position.set(x, G + 2.5, z);
    post.rotation.z = r() < 0.3 ? 0.25 : 0;
    kit.add(post, m.steel, { collide: false, tile: 1 });
  }
  // The young forest: birch and maple, thick to the east and north, thinning towards the tower.
  for (let i = 0; i < 46; i++) {
    const x = p.x0 + 4 + r() * (p.x1 - p.x0 - 8);
    const z = p.z0 + 4 + r() * (p.z1 - p.z0 - 8);
    if (x > t.x0 - 4 && x < t.x1 + 4 && z < t.z1 + 3) continue;
    if (Math.hypot(x - f.x, z - f.z) < 9) continue;
    if (Math.abs(z - TOWER.crane.from.z) < 3 && x < t.x0 && x > TOWER.crane.from.x - 10) continue;
    if (x > 588 && x < 604 && z > t.z1 && z < 8) continue;
    const birch = r() < 0.55;
    tree(kit, scene, m, r, x, G, z, birch ? 6 + r() * 5 : 7 + r() * 6, birch);
  }
}

/** Low, ruined office blocks closing in the plaza, and the rest of the district's towers further out. */
function buildSurroundings(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const p = TOWER.plaza;
  const G = L[0];
  const block = (x0: number, x1: number, z0: number, z1: number, h: number) => {
    tiled(kit, "plazaBuilding", x0, x1, G - 1, G + h, z0, z1, r() < 0.5 ? m.facade : m.facadeDark);
    // Roofline greenery.
    const blob = MeshBuilder.CreateSphere("roofGreen", { diameter: Math.min(x1 - x0, z1 - z0) * 0.8, segments: 5 }, scene);
    blob.scaling.y = 0.4;
    blob.position.set((x0 + x1) / 2, G + h, (z0 + z1) / 2);
    kit.add(blob, m.leaves, { collide: false, cast: false });
  };
  // West: along the old street over the station.
  for (let z = p.z0; z < p.z1; z += 14) block(p.x0 - 12, p.x0, z, z + 13, 9 + r() * 10);
  // North and east.
  for (let x = p.x0; x < p.x1; x += 16) block(x, x + 15, p.z1, p.z1 + 12, 10 + r() * 14);
  for (let z = p.z0; z < p.z1 + 12; z += 15) block(p.x1, p.x1 + 14, z, z + 14, 12 + r() * 16);
  // South: behind the tower.
  for (let x = p.x0 - 12; x < p.x1; x += 17) block(x, x + 16, p.z0 - 14, p.z0, 10 + r() * 12);
  // A few nearer towers to the east and south, real geometry (the haze takes the rest).
  for (const [x, z, w, h] of [[700, -60, 26, 120], [740, 20, 22, 96], [690, 70, 18, 70], [620, -110, 24, 88], [780, -40, 30, 140]] as const) {
    tiled(kit, "districtTower", x - w / 2, x + w / 2, G - 1, G + h, z - w / 2, z + w / 2, m.windows, { cast: false, collide: false });
    const crown = MeshBuilder.CreateSphere("towerTopGarden", { diameter: w * 0.9, segments: 5 }, scene);
    crown.scaling.y = 0.35;
    crown.position.set(x, G + h + 1, z);
    kit.add(crown, m.leaves, { collide: false, cast: false });
  }
}

// --- Ledge Kite nest and the Predecessor -----------------------------------------------------

function buildNest(scene: Scene): Mesh[] {
  const n = TOWER.nest;
  const f = new Form(scene, "kiteNest");
  const stick = organic(scene, "kite-nest-sticks", "#5d4a36", "bark");
  const lining = organic(scene, "kite-nest-lining", "#8a7a62", "fur");
  const r = rng(808);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, rad = 0.55 + r() * 0.4;
    const y = n.y + 0.05 + r() * 0.35;
    f.taper([[n.x + Math.cos(a) * rad, y, n.z + Math.sin(a) * rad], [n.x + Math.cos(a + 1.2) * rad, y + (r() - 0.5) * 0.15, n.z + Math.sin(a + 1.2) * rad]], 0.025, 0.015, stick, 4);
  }
  f.ellipsoid([n.x, n.y + 0.22, n.z], [1.1, 0.25, 1.1], lining, 8);
  return f.finish();
}

/** The older unit, sitting at the terrace's east edge, facing the skyline. */
function buildPredecessor(kit: Kit, scene: Scene): Mesh[] {
  const p = TOWER.predecessor;
  const node = new TransformNode("predecessorTerrace", scene);
  node.position.copyFrom(p);
  node.rotation.y = Math.PI / 2;
  const parts = predecessorVisual(scene, node, { headPitch: -0.12 });
  for (const part of parts) kit.add(part, part.material as StandardMaterial, { keep: true, collide: false, tile: undefined });
  // Its status light, still on.
  const led = MeshBuilder.CreateSphere("predecessorLed", { diameter: 0.05, segments: 4 }, scene);
  led.parent = node;
  led.position.set(0.24, 0.85, 0.1);
  const ledMat = new StandardMaterial("predecessorTerraceLed", scene);
  ledMat.emissiveColor = new Color3(0.1, 0.35, 0.42);
  ledMat.disableLighting = true;
  led.material = ledMat;
  led.isPickable = false;
  kit.box("predecessorCollider", p.x - 0.5, p.x + 0.5, p.y, p.y + 1, p.z - 0.5, p.z + 0.5, kit.flat("alien", 0.12, 0.13, 0.16, 0.6), { hidden: true, cast: false });
  return parts;
}

// --- Plants and far skyline ---------------------------------------------------------------------

function buildPlants(scene: Scene, r: () => number): void {
  const grass = card(scene, "grassTuft");
  const fern = card(scene, "fern");
  const p = TOWER.plaza;
  const t = TOWER.tower;
  const G = L[0];
  const tufts: { x: number; y: number; z: number; s: number }[] = [];
  const ferns: { x: number; y: number; z: number; s: number }[] = [];
  for (let i = 0; i < 900; i++) {
    const x = p.x0 + 1 + r() * (p.x1 - p.x0 - 2);
    const z = p.z0 + 1 + r() * (p.z1 - p.z0 - 2);
    if (x > t.x0 - 0.5 && x < t.x1 + 0.5 && z > t.z0 - 0.5 && z < t.z1 + 0.5) continue;
    if (x > 589 && x < 603 && z > t.z1 && z < t.z1 + 4) continue;
    (r() < 0.85 ? tufts : ferns).push({ x, y: G + 0.02, z, s: 0.8 + r() * 0.9 });
  }
  // On the upper floors, wherever the light reaches through the split.
  for (let i = 1; i < L.length; i++) for (let k = 0; k < 14; k++) tufts.push({ x: TOWER.bay.x0 + r() * 11.5, y: L[i] + 0.02, z: t.z0 + 1 + r() * 26, s: 0.6 + r() * 0.5 });
  for (let k = 0; k < 40; k++) tufts.push({ x: t.x0 + 1 + r() * 34, y: L[8] + 0.05, z: TOWER.shaft.z1 + 0.5 + r() * 15, s: 0.8 + r() * 0.6 });
  const g = scatterCards(scene, "towerGrass", grass, 0.9, 0.7, 2, tufts, r);
  if (g) g.name = "ferns";
  const fe = scatterCards(scene, "towerFerns", fern, 1.2, 0.9, 3, ferns, r);
  if (fe) fe.name = "ferns";
}

/**
 * The rest of the Financial District beyond the plaza: tower silhouettes in the
 * haze, like the cedar from Shrine Street. They ignore the fog and take its colour.
 */
function buildSkyline(scene: Scene, r: () => number): void {
  const material = new StandardMaterial("skylineHaze", scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  const parts: Mesh[] = [];
  const cx = 600, cz = -20;
  for (let i = 0; i < 46; i++) {
    // Mostly east and south, where the district goes on.
    const a = -Math.PI * 0.55 + r() * Math.PI * 1.25;
    const d = 220 + r() * 230;
    const w = 14 + r() * 26;
    const h = 50 + r() * 150 * (1 - Math.abs(a) / 3);
    const b = MeshBuilder.CreateBox("skylineTower", { width: w, height: h, depth: w * (0.7 + r() * 0.6) }, scene);
    b.position.set(cx + Math.cos(a) * d, h / 2 - 5, cz - Math.sin(a) * d);
    b.rotation.y = r() * 0.5;
    parts.push(b);
    // A rounded green crown on most of them.
    if (r() < 0.7) {
      const crown = MeshBuilder.CreateSphere("skylineCrown", { diameter: w * 0.9, segments: 4 }, scene);
      crown.scaling.y = 0.45;
      crown.position.set(b.position.x, h - 5, b.position.z);
      parts.push(crown);
    }
  }
  const haze = Mesh.MergeMeshes(parts, true)!;
  haze.name = "skylineHaze";
  haze.material = material;
  haze.applyFog = false;
  haze.isPickable = false;
  haze.freezeWorldMatrix();
  scene.onBeforeRenderObservable.add(() => {
    if (!haze.isEnabled()) return;
    const f = scene.fogColor;
    material.emissiveColor.set(f.r * 0.8, f.g * 0.84, f.b * 0.88);
  });
}

// --- Painted textures ------------------------------------------------------------------------

function drawMarble(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#b9b2a4";
  c.fillRect(0, 0, s, s);
  // Large tiles with dark veins and grime in the joints.
  for (let i = 0; i < 18; i++) {
    c.strokeStyle = `rgba(${90 + r() * 30},${86 + r() * 20},${78 + r() * 20},${0.25 + r() * 0.3})`;
    c.lineWidth = 0.6 + r() * 1.6;
    c.beginPath();
    let x = r() * s, y = r() * s;
    c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 50; y += (r() - 0.5) * 40; c.lineTo(x, y); }
    c.stroke();
  }
  c.strokeStyle = "rgba(60,56,48,0.6)";
  c.lineWidth = 2;
  for (const v of [0, s / 2]) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, s); c.moveTo(0, v); c.lineTo(s, v); c.stroke(); }
  for (let i = 0; i < 500; i++) {
    c.fillStyle = `rgba(50,48,40,${r() * 0.1})`;
    c.fillRect(r() * s, r() * s, 1 + r() * 5, 1 + r() * 5);
  }
}

function drawBirchBark(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#d6d1c4";
  c.fillRect(0, 0, s, s);
  // Dark horizontal lenticels and black patches.
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(40,38,34,${0.4 + r() * 0.5})`;
    c.fillRect(r() * s, r() * s, 4 + r() * 18, 1 + r() * 2);
  }
  for (let i = 0; i < 6; i++) {
    c.fillStyle = "rgba(30,28,26,0.75)";
    c.beginPath();
    c.ellipse(r() * s, r() * s, 3 + r() * 8, 2 + r() * 5, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function drawGlass(c: Ctx, s: number, r: () => number): void {
  // Dark, dusty glass with a pale sky reflection towards the top, and a few cracks.
  const g = c.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, "#7d8c8e");
  g.addColorStop(0.45, "#4a5759");
  g.addColorStop(1, "#2f3838");
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
  for (let i = 0; i < 30; i++) {
    const x = r() * s, len = s * (0.15 + r() * 0.6);
    const d = c.createLinearGradient(0, s - len, 0, s);
    d.addColorStop(0, "rgba(120,110,90,0)");
    d.addColorStop(1, "rgba(120,110,90,0.35)");
    c.fillStyle = d;
    c.fillRect(x, s - len, 4 + r() * 10, len);
  }
  c.strokeStyle = "rgba(210,215,210,0.5)";
  c.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const x = r() * s, y = r() * s;
    for (let k = 0; k < 5; k++) {
      c.beginPath(); c.moveTo(x, y);
      const a = r() * Math.PI * 2;
      c.lineTo(x + Math.cos(a) * 30 * r(), y + Math.sin(a) * 30 * r());
      c.stroke();
    }
  }
}

function drawWindows(c: Ctx, s: number, r: () => number): void {
  // One storey of curtain wall: spandrel band at the bottom, glazing with mullions above.
  c.fillStyle = "#5b6060";
  c.fillRect(0, 0, s, s);
  const band = s * 0.28;
  const g = c.createLinearGradient(0, 0, 0, s - band);
  g.addColorStop(0, "#6d7c7f");
  g.addColorStop(1, "#38433f");
  c.fillStyle = g;
  c.fillRect(0, 0, s, s - band);
  c.fillStyle = "#4b4f4d";
  for (const x of [0, s / 2]) c.fillRect(x, 0, 6, s);
  c.fillStyle = "#6a6c68";
  c.fillRect(0, s - band, s, band);
  // Missing and dark panes, green streaks running down.
  for (const x of [6, s / 2 + 6]) if (r() < 0.3) { c.fillStyle = "#1c2220"; c.fillRect(x, 4, s / 2 - 12, s - band - 8); }
  for (let i = 0; i < 6; i++) {
    const x = r() * s;
    const d = c.createLinearGradient(0, 0, 0, s);
    d.addColorStop(0, "rgba(70,90,50,0.45)");
    d.addColorStop(1, "rgba(70,90,50,0)");
    c.fillStyle = d;
    c.fillRect(x, 0, 3 + r() * 8, s);
  }
}

function drawCarpet(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#4d4c48";
  c.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "30,30,28" : "110,104,90"},${r() * 0.2})`;
    c.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3);
  }
  c.strokeStyle = "rgba(30,30,28,0.35)";
  c.strokeRect(0.5, 0.5, s - 1, s - 1);
}

function drawDirectory(c: Ctx, s: number, r: () => number): void {
  // Dark board, gold header, rows of firm names, each with the same small sticker over it.
  c.fillStyle = "#1d1f1e";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#a08a52";
  c.fillRect(s * 0.08, s * 0.06, s * 0.84, s * 0.07);
  c.fillStyle = "#1d1f1e";
  c.font = `bold ${s * 0.05}px sans-serif`;
  c.textAlign = "center";
  c.fillText("DIRECTORY", s / 2, s * 0.115);
  c.textAlign = "left";
  for (let i = 0; i < 14; i++) {
    const y = s * (0.2 + i * 0.054);
    c.fillStyle = "#b9b2a0";
    c.font = `${s * 0.03}px sans-serif`;
    c.fillText(`${8 - Math.floor(i / 2)}F`, s * 0.1, y + s * 0.03);
    c.fillStyle = "rgba(200,192,170,0.5)";
    c.fillRect(s * 0.22, y + s * 0.01, s * (0.4 + r() * 0.25), s * 0.022);
    // The sticker: cream, slightly crooked.
    c.save();
    c.translate(s * (0.46 + r() * 0.1), y + s * 0.022);
    c.rotate((r() - 0.5) * 0.15);
    c.fillStyle = "#d8cfb4";
    c.fillRect(-s * 0.09, -s * 0.018, s * 0.18, s * 0.036);
    c.fillStyle = "#6a3a2a";
    c.font = `bold ${s * 0.026}px sans-serif`;
    c.textAlign = "center";
    c.fillText("MOVED", 0, s * 0.01);
    c.textAlign = "left";
    c.restore();
  }
}

function drawCityModel(c: Ctx, s: number, r: () => number): void {
  // The base of the model: sea along the north edge (top), the coast, streets and districts.
  c.fillStyle = "#cfc8b6";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#7f9aa0";
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(s, 0);
  for (let x = s; x >= 0; x -= s / 16) c.lineTo(x, s * (0.2 + Math.sin(x * 0.03) * 0.04 + r() * 0.02));
  c.closePath();
  c.fill();
  // A river into the sea.
  c.strokeStyle = "#7f9aa0";
  c.lineWidth = s * 0.02;
  c.beginPath();
  c.moveTo(s * 0.3, s);
  c.bezierCurveTo(s * 0.35, s * 0.7, s * 0.25, s * 0.5, s * 0.32, s * 0.22);
  c.stroke();
  // Street grid.
  c.strokeStyle = "rgba(120,112,96,0.6)";
  c.lineWidth = 1;
  for (let x = 0; x < s; x += s / 24) { c.beginPath(); c.moveTo(x, s * 0.24); c.lineTo(x + (r() - 0.5) * 6, s); c.stroke(); }
  for (let y = s * 0.28; y < s; y += s / 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(s, y + (r() - 0.5) * 6); c.stroke(); }
  // The planned sea wall: a dashed red line along the coast, labelled.
  c.strokeStyle = "#8a3a2c";
  c.lineWidth = 2;
  c.setLineDash([6, 4]);
  c.beginPath();
  for (let x = 0; x <= s; x += s / 16) c.lineTo(x, s * (0.25 + Math.sin(x * 0.03) * 0.04));
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#5a2a20";
  c.font = `${s * 0.025}px sans-serif`;
  c.fillText("SEA WALL · PHASE 1–7", s * 0.05, s * 0.33);
  c.fillText("PHASE 8", s * 0.86, s * 0.33);
}
