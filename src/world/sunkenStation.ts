import { Color3, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, Vector3 } from "../babylon";
import { Kit, scatterCards, stairs, type PieceOptions } from "./kit";
import { buildRelayModel } from "./relay";
import { card, paint, rng, type Ctx } from "./textures";
import { Form, organic } from "./life/visuals";

/**
 * Block 4, the Sunken Station: the metro station under the Flooded Arcade.
 * Layout and content follow docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md.
 *
 *   arcade station stairs (x 386..394), behind a flood barrier, down to y -3.2
 *   → corridor A east under the arcade's end building (x 394..408)
 *   → corridor B south (x 404..408, where the blocks swap)
 *   → stairs C east, down to the ticket hall (y -7)
 *   → ticket hall (x 422..452): ticket machines, gates, the departure board, Relay Station 4
 *   → escalators down to the platform (y -13.5)
 *   → platform (x 468..560) with the stopped train on the north track, the root
 *     column in a light shaft, and the maintenance tunnel behind the south wall
 *
 * The station is all below the street, so nothing of the arcade overlaps it.
 * Daylight only gets in through three shafts where the street above fell in.
 */
export const STATION = {
  /** Corridor A: from the foot of the arcade's station stairs, east. */
  corridorA: { x0: 394, x1: 408, z0: 16, z1: 22 },
  /** Corridor B: south, towards the stairs down. The blocks swap in here. */
  corridorB: { x0: 404, x1: 408, z0: 4, z1: 22 },
  /** Stairs C: east, down to the ticket hall. */
  stairsC: { x0: 408, x1: 422, z0: 4, z1: 8 },
  /** Floor and ceiling of corridors A and B. */
  passageFloor: -3.2,
  passageCeiling: 0.6,
  hall: { x0: 422, x1: 452, z0: -8, z1: 14, floor: -7, ceiling: -2.5 },
  escalators: { x0: 452, x1: 468, z0: 0, z1: 6 },
  platform: { x0: 468, x1: 560, z0: -3, z1: 7, floor: -13.5, ceiling: -7.5 },
  track: { z0: 7, z1: 12.5, bed: -14.7 },
  /** Behind the platform's south wall. */
  tunnel: { x0: 476, x1: 554, z0: -7, z1: -4, ceiling: -10.5 },
  den: { x0: 508, x1: 518, z0: -10.5, z1: -7 },
  /** Doors from the platform into the tunnel, at both ends. */
  tunnelDoors: [
    { x0: 476.5, x1: 478.5 },
    { x0: 551.5, x1: 553.5 },
  ],
  train: { x0: 474, x1: 537.5, z0: 7.3, z1: 10.3, roof: -10.3 },
  cars: [
    [474, 494.5],
    [495.5, 516],
    [517, 537.5],
  ] as [number, number][],
  shafts: [
    { x0: 436, x1: 440, z0: 0, z1: 4 },
    { x0: 489, x1: 495, z0: -1, z1: 5 },
    { x0: 527, x1: 531, z0: -1, z1: 3 },
  ],
  /** Top of the light shafts: the street level above. */
  surface: 1.5,
  rootColumn: new Vector3(492, -13.5, 2),
  /** Drip pools: one lit (under the root column's shaft), the rest in the dark. */
  pools: [
    { x: 488.4, z: 0.9, r: 1.3, lit: true },
    { x: 490.5, z: -5.3, r: 0.95, lit: false },
    { x: 535, z: -5.3, r: 1.05, lit: false },
  ],
  relay: { x: 430, z: 9.5 },
  board: { x: 445.4, z: 3 },
  gatesX: 446,
};

export type StationRegion = "arcade" | "station";

/**
 * Which block to draw for a robot at `p` near the station, or undefined to keep
 * the current one. Two thresholds in corridor B give hysteresis; from there
 * neither the arcade nor the ticket hall is in view.
 */
export function stationRegionAt(p: Vector3, current: StationRegion): StationRegion | undefined {
  const b = STATION.corridorB;
  if (p.x < b.x0 - 0.5) return "arcade";
  if (p.x > b.x1 + 0.5) return "station";
  if (current === "arcade" && p.z < 11) return "station";
  if (current === "station" && p.z > 13) return "arcade";
  return undefined;
}

/** How far underground the robot is, for the lighting: 0 in the open, 1 below the street. */
export function undergroundAt(p: Vector3): number {
  if (p.x < 385.5) return 0;
  return Math.min(1, Math.max(0, -p.y / 2.5));
}

export interface SunkenStation {
  relayStation: Mesh;
  relayGlow: StandardMaterial;
  spawn: Vector3;
  spawnYaw: number;
  board: Mesh[];
  ticketMachines: Mesh[];
  /** Ticket slot of each machine, where the beetles come out. */
  slots: Vector3[];
  stationMap: Mesh[];
  umbrellas: Mesh[];
  lostFound: Mesh[];
  charger: Mesh[];
  /** Swift nests above the east tunnel mouth. */
  nests: Vector3[];
  /** Light shaft beams (the life code fades them with the daylight). */
  beams: Mesh[];
  /** The landmark: a column of roots grown down the platform's middle shaft. */
  rootColumn: Mesh[];
}

type Mats = Record<string, StandardMaterial>;

/** The way down from the arcade: corridors A and B and stairs C. Drawn with both blocks. */
export function buildStationPassage(scene: Scene, shadows: ShadowGenerator): void {
  const kit = new Kit(scene, shadows);
  const m = materials(kit, scene);
  const { corridorA: a, corridorB: b, stairsC: c, passageFloor: floor, passageCeiling: ceil, hall } = STATION;
  const r = rng(4104);
  // Floors.
  kit.box("passageFloorA", a.x0, a.x1, floor - 1, floor, a.z0, a.z1, m.floor, { cast: false });
  kit.box("passageFloorB", b.x0, b.x1, floor - 1, floor, b.z0, a.z0, m.floor, { cast: false });
  // Walls: tiles on the inside, solid behind.
  const wall = (name: string, x0: number, x1: number, z0: number, z1: number, y0 = floor - 1, y1 = ceil + 0.4) => tiled(kit, name, x0, x1, y0, y1, z0, z1, m.tile);
  wall("passageWallAN", a.x0, b.x1 + 0.4, a.z1, a.z1 + 0.4);
  wall("passageWallAS", a.x0, b.x0, a.z0 - 0.4, a.z0);
  wall("passageWallBW", b.x0 - 0.4, b.x0, b.z0 - 0.4, a.z0);
  wall("passageWallBE", b.x1, b.x1 + 0.4, c.z1, a.z1 + 0.4);
  wall("passageWallBS", b.x0 - 0.4, c.x0, b.z0 - 0.4, b.z0);
  // A green tile band along the foot of the walls.
  for (const [x0, x1, z0, z1] of [
    [a.x0, b.x1, a.z1 - 0.02, a.z1],
    [a.x0, b.x0, a.z0, a.z0 + 0.02],
    [b.x0, b.x0 + 0.02, b.z0, a.z0],
    [b.x1 - 0.02, b.x1, c.z1, a.z1],
  ] as const) tiled(kit, "passageBand", x0, x1, floor, floor + 1.2, z0, z1, m.tileGreen, { collide: false, cast: false });
  kit.box("passageCeilingA", a.x0, b.x1 + 0.4, ceil, ceil + 0.4, a.z0 - 0.4, a.z1 + 0.4, m.ceiling);
  kit.box("passageCeilingB", b.x0 - 0.4, b.x1 + 0.4, ceil, ceil + 0.4, b.z0 - 0.4, a.z0, m.ceiling);
  // Stairs C down to the ticket hall, in a tall stairwell.
  stairs(kit, scene, "stationStairsC", c.x1, c.x0, c.z0, c.z1, hall.floor, floor, m.concrete);
  kit.box("stairsCUnder", c.x0, c.x1, hall.floor - 1, hall.floor, c.z0, c.z1, m.floor, { cast: false });
  wall("stairsCWallS", c.x0, c.x1, c.z0 - 0.4, c.z0, hall.floor - 1);
  wall("stairsCWallN", c.x0, c.x1, c.z1, c.z1 + 0.4, hall.floor - 1);
  kit.box("stairsCCeiling", c.x0, c.x1, ceil, ceil + 0.4, c.z0 - 0.4, c.z1 + 0.4, m.ceiling);
  // Over the hall's doorway: the wall from the hall ceiling up to the stairwell's.
  kit.box("stairsCHeader", c.x1 - 0.2, c.x1 + 0.2, hall.ceiling, ceil + 0.4, c.z0 - 0.4, c.z1 + 0.4, m.concreteDark);
  // Handrails on both sides of the stairs.
  for (const z of [c.z0 + 0.15, c.z1 - 0.15]) kit.slope("stairsCRail", new Vector3(c.x0, floor + 0.9, z), new Vector3(c.x1, hall.floor + 0.9, z), 0.06, 0.06, m.steel, { collide: false, cast: false });
  // A sign at the turn: the way down to the trains.
  const sign = MeshBuilder.CreatePlane("passageSign", { width: 2.2, height: 0.55 }, scene);
  sign.position.set((b.x0 + b.x1) / 2, ceil - 0.5, a.z0 - 0.4);
  sign.rotation.y = Math.PI;
  sign.material = m.wayfinding;
  sign.isPickable = false;
  sign.freezeWorldMatrix();
  // Silt and leaves washed down from the arcade, and a few fallen tiles.
  for (let i = 0; i < 14; i++) {
    const s = 0.15 + r() * 0.25;
    const tile = MeshBuilder.CreateBox("passageTile", { width: s * 2, height: 0.03, depth: s * 2 }, scene);
    const inA = i < 8;
    tile.position.set(inA ? a.x0 + 1 + r() * 12 : b.x0 + 0.4 + r() * 3.2, floor + 0.015, inA ? (r() < 0.5 ? a.z0 + 0.4 : a.z1 - 0.4) : b.z0 + 1 + r() * 11);
    tile.rotation.y = r() * 3;
    kit.add(tile, m.tile, { collide: false, cast: false, tile: 1 });
  }
  kit.box("passageSilt", a.x0, a.x0 + 5, floor, floor + 0.04, a.z0 + 0.5, a.z1 - 0.5, m.dirt, { collide: false, cast: false });
  kit.finish();
}

export function buildSunkenStation(scene: Scene, shadows: ShadowGenerator): SunkenStation {
  const kit = new Kit(scene, shadows);
  const m = materials(kit, scene);
  const r = rng(5021);
  buildHall(kit, scene, m, r);
  const machines = buildTicketMachines(kit, scene, m);
  const board = buildDepartureBoard(kit, scene, m);
  const props = buildHallProps(kit, scene, m, r);
  buildEscalators(kit, scene, m);
  buildPlatform(kit, scene, m, r);
  buildTrain(kit, scene, m, r);
  buildTunnel(kit, scene, m, r);
  const shafts = buildShafts(kit, scene, m, r);
  const charger = buildCharger(kit, scene, m);
  const nests = buildNests(kit, scene, m, r);
  const rootColumn = buildRootColumn(kit, scene, r);
  buildPools(kit, scene, m);

  // Relay Station 4, in the ticket hall.
  const relayGlow = new StandardMaterial("glowStation", scene);
  relayGlow.emissiveColor = new Color3(0.35, 0.85, 1);
  relayGlow.disableLighting = true;
  const solid = (mesh: Mesh, material: StandardMaterial, cast = true) => kit.add(mesh, material, { cast, keep: true });
  const { x, z } = STATION.relay;
  const relayStation = buildRelayModel(scene, solid, { concrete: m.concrete, metal: m.steel, rust: m.rust, solar: m.solar, alien: kit.flat("alien", 0.12, 0.13, 0.16, 0.6), glow: relayGlow }, x, z, STATION.hall.floor);

  kit.finish();
  buildPlants(scene, r);

  return {
    relayStation,
    relayGlow,
    spawn: new Vector3(x + 2.6, STATION.hall.floor + 0.2, z - 1.2),
    spawnYaw: Math.PI / 2,
    board,
    ticketMachines: machines.meshes,
    slots: machines.slots,
    stationMap: props.stationMap,
    umbrellas: props.umbrellas,
    lostFound: props.lostFound,
    charger,
    nests,
    beams: shafts,
    rootColumn,
  };
}

// --- Materials ---------------------------------------------------------------------

const TILE_SIZES = new Map<StandardMaterial, number>();

/** A box in a painted material, tiled at that material's repeat size. */
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
    stone: kit.tex("stone", 2),
    dirt: kit.tex("dirt", 4),
    rubble: kit.tex("rubble", 3),
    rust: kit.tex("rust", 2),
    solar: kit.tex("solar", 1),
    steel: kit.flat("stationSteel", 0.36, 0.37, 0.36, 0.25),
    rail: kit.flat("stationRail", 0.3, 0.27, 0.24, 0.35),
    dark: kit.flat("stationDark", 0.02, 0.025, 0.03, 0),
    tile: painted(scene, "stationTile", 256, 2.4, drawTiles([196, 190, 170]), 0.12),
    tileGreen: painted(scene, "stationTileGreen", 256, 2.4, drawTiles([92, 118, 98]), 0.12),
    edge: painted(scene, "platformEdge", 128, 1, drawPlatformEdge),
    carSide: painted(scene, "trainSide", 256, 5, drawTrainSide, 0.15),
    carRoof: painted(scene, "trainRoof", 128, 3, drawTrainRoof, 0.1),
    seat: kit.flat("trainSeat", 0.22, 0.27, 0.32, 0.05),
    wayfinding: signMaterial(scene, "stationWayfinding", 256, drawWayfinding),
  };
}

function signMaterial(scene: Scene, name: string, size: number, draw: (c: Ctx, s: number, r: () => number) => void): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const mat = new StandardMaterial(name, scene);
  mat.diffuseTexture = paint(scene, `tex:${name}`, size, draw, false, true);
  mat.specularColor = Color3.Black();
  return mat;
}

// --- Ticket hall -----------------------------------------------------------------------

function buildHall(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const h = STATION.hall;
  const c = STATION.stairsC;
  const e = STATION.escalators;
  kit.box("hallFloor", h.x0, h.x1, h.floor - 1, h.floor, h.z0, h.z1, m.floor, { cast: false });
  // Ceiling with a hole for the light shaft.
  slabWithHoles(kit, "hallCeiling", h.x0 - 0.4, h.x1 + 0.4, h.z0 - 0.4, h.z1 + 0.4, h.ceiling, h.ceiling + 0.8, [STATION.shafts[0]], m.ceiling);
  // Walls, leaving the doorways to stairs C (west) and the escalators (east).
  const wall = (name: string, x0: number, x1: number, z0: number, z1: number, y0 = h.floor - 1, y1 = h.ceiling) => tiled(kit, name, x0, x1, y0, y1, z0, z1, m.tile);
  wall("hallWallN", h.x0 - 0.4, h.x1 + 0.4, h.z1, h.z1 + 0.4);
  wall("hallWallS", h.x0 - 0.4, h.x1 + 0.4, h.z0 - 0.4, h.z0);
  wall("hallWallW1", h.x0 - 0.4, h.x0, h.z0, c.z0 - 0.4);
  wall("hallWallW2", h.x0 - 0.4, h.x0, c.z1 + 0.4, h.z1);
  wall("hallWallE1", h.x1, h.x1 + 0.4, h.z0, e.z0);
  wall("hallWallE2", h.x1, h.x1 + 0.4, e.z1, h.z1);
  for (const [x0, x1, z0, z1] of [
    [h.x0, h.x1, h.z1 - 0.02, h.z1],
    [h.x0, h.x1, h.z0, h.z0 + 0.02],
  ] as const) tiled(kit, "hallBand", x0, x1, h.floor, h.floor + 1.2, z0, z1, m.tileGreen, { collide: false, cast: false });
  // Square pillars in two rows.
  for (const x of [428, 436, 444]) for (const z of [-2.5, 9]) {
    if (x === 436 && z === -2.5) continue;
    tiled(kit, "hallPillar", x - 0.45, x + 0.45, h.floor, h.ceiling, z - 0.45, z + 0.45, m.tile);
  }
  // The ticket gates: a row of cabinets across the hall, three of them passable.
  const gx = STATION.gatesX;
  const open = new Set([2, 6, 11]);
  for (let i = 0; i < 16; i++) {
    const z = h.z0 + 1 + i * 1.3;
    if (z > h.z1 - 1) break;
    if (open.has(i)) continue;
    kit.box("ticketGate", gx, gx + 1.5, h.floor, h.floor + 1.05, z - 0.18, z + 0.18, m.steel);
    kit.box("ticketGateTop", gx - 0.02, gx + 1.52, h.floor + 1.05, h.floor + 1.12, z - 0.2, z + 0.2, m.rust, { collide: false, cast: false });
    // Flaps: some still closed, some hanging.
    if (r() < 0.5) kit.box("ticketGateFlap", gx + 0.6, gx + 0.65, h.floor + 0.55, h.floor + 0.95, z + 0.18, z + 0.6, m.rust, { collide: false, cast: false });
  }
  // A low wall closes the gates off at both ends.
  kit.box("gateEndS", gx, gx + 1.5, h.floor, h.floor + 1.05, h.z0, h.z0 + 0.6, m.steel);
  // The station office in the south-west corner, with the lost-and-found window.
  const o = { x0: h.x0, x1: 430, z0: h.z0, z1: -2 };
  tiled(kit, "officeWallN1", o.x0, o.x1 - 3.5, h.floor, h.ceiling, o.z1, o.z1 + 0.2, m.tile);
  tiled(kit, "officeWallN2", o.x1 - 1.5, o.x1, h.floor, h.ceiling, o.z1, o.z1 + 0.2, m.tile);
  kit.box("officeDoorHead", o.x1 - 3.5, o.x1 - 1.5, h.floor + 2.2, h.ceiling, o.z1, o.z1 + 0.2, m.concrete);
  tiled(kit, "officeWallE1", o.x1 - 0.2, o.x1, h.floor, h.floor + 1.1, o.z0, o.z1, m.tile);
  tiled(kit, "officeWallE2", o.x1 - 0.2, o.x1, h.floor + 2.3, h.ceiling, o.z0, o.z1, m.tile);
  tiled(kit, "officeWallE3", o.x1 - 0.2, o.x1, h.floor + 1.1, h.floor + 2.3, o.z0, o.z0 + 1.2, m.tile);
  tiled(kit, "officeWallE4", o.x1 - 0.2, o.x1, h.floor + 1.1, h.floor + 2.3, o.z1 - 1.2, o.z1, m.tile);
  kit.box("officeSill", o.x1 - 0.3, o.x1 + 0.25, h.floor + 1.05, h.floor + 1.15, o.z0 + 1.2, o.z1 - 1.2, m.steel, { collide: false });
  kit.box("officeDesk", o.x0 + 1, o.x0 + 3, h.floor, h.floor + 0.8, o.z0 + 1, o.z0 + 3.6, m.rust);
  // Silt and fallen ceiling.
  for (let i = 0; i < 16; i++) {
    const s = 0.2 + r() * 0.45;
    const rock = MeshBuilder.CreateBox("hallDebris", { width: s * 1.6, height: s * 0.5, depth: s }, scene);
    rock.position.set(h.x0 + 2 + r() * 26, h.floor + s * 0.2, h.z0 + 1 + r() * 20);
    rock.rotation.set(r() * 0.3, r() * 3, r() * 0.3);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }
  kit.box("hallSilt", h.x0, h.x0 + 6, h.floor, h.floor + 0.03, c.z0 - 2, c.z1 + 2, m.dirt, { collide: false, cast: false });
}

/** A horizontal slab with rectangular holes cut out (shafts in a ceiling). */
function slabWithHoles(kit: Kit, name: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, holes: { x0: number; x1: number; z0: number; z1: number }[], material: StandardMaterial): void {
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    const cut = holes.filter((h) => h.x0 < b && h.x1 > a).sort((p, q) => p.z0 - q.z0);
    let z = z0;
    for (const h of cut) {
      if (h.z0 > z) kit.box(name, a, b, y0, y1, z, h.z0, material);
      z = Math.max(z, h.z1);
    }
    if (z < z1) kit.box(name, a, b, y0, y1, z, z1, material);
  }
}

function buildTicketMachines(kit: Kit, scene: Scene, m: Mats): { meshes: Mesh[]; slots: Vector3[] } {
  const h = STATION.hall;
  const face = new StandardMaterial("ticketMachineFace", scene);
  face.diffuseTexture = paint(scene, "tex:ticketMachineFace", 256, drawMachineFace, false, true);
  face.specularColor = new Color3(0.12, 0.12, 0.12);
  const parts: Mesh[] = [];
  const slots: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const x = 433 + i * 1.6;
    const z1 = h.z1;
    const body = MeshBuilder.CreateBox("ticketMachine", { width: 1.2, height: 1.9, depth: 0.8 }, scene);
    body.position.set(x, h.floor + 0.95, z1 - 0.4);
    // Box faces: the front (-z) shows the painted panel; the rest is plain steel grey from the same texture's edge.
    parts.push(body);
    slots.push(new Vector3(x + 0.25, h.floor + 1.12, z1 - 0.81));
  }
  const merged = Mesh.MergeMeshes(parts, true)!;
  merged.name = "ticketMachines";
  kit.add(merged, face, { keep: true, tile: undefined });
  // Box UVs map the whole panel to every face; good enough on the sides, which are against each other.
  merged.isPickable = true;
  void m;
  return { meshes: [merged], slots };
}

function buildDepartureBoard(kit: Kit, scene: Scene, m: Mats): Mesh[] {
  const h = STATION.hall;
  const { x, z } = STATION.board;
  const mat = new StandardMaterial("departureBoard", scene);
  mat.diffuseTexture = paint(scene, "tex:departureBoard", 512, drawDepartureBoard, false, true);
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  const frame = kit.box("departureBoardFrame", x - 0.25, x, h.floor + 3.2, h.floor + 4.4, z - 3.1, z + 3.1, m.steel, { keep: true, collide: false });
  const face = MeshBuilder.CreatePlane("departureBoard", { width: 6, height: 1.1 }, scene);
  face.position.set(x - 0.27, h.floor + 3.8, z);
  face.rotation.y = Math.PI / 2;
  face.material = mat;
  face.receiveShadows = true;
  face.freezeWorldMatrix();
  for (const dz of [-2.6, 2.6]) kit.box("departureBoardHanger", x - 0.15, x - 0.1, h.floor + 4.4, h.ceiling, z + dz - 0.03, z + dz + 0.03, m.steel, { collide: false, cast: false });
  // The notices pasted on the gate cabinets' end, below the board.
  const notes = new StandardMaterial("evacuationNotices", scene);
  notes.diffuseTexture = paint(scene, "tex:evacuationNotices", 256, drawNotices, false, true);
  notes.specularColor = Color3.Black();
  const paper = MeshBuilder.CreatePlane("evacuationNotices", { width: 2.4, height: 1.2 }, scene);
  paper.position.set(x - 0.03, h.floor + 2.4, z);
  paper.rotation.y = Math.PI / 2;
  paper.material = notes;
  paper.freezeWorldMatrix();
  kit.box("noticeBoard", x - 0.02, x + 0.1, h.floor + 1.7, h.floor + 3.1, z - 1.4, z + 1.4, m.concreteDark, { keep: true, collide: false });
  return [face, frame, paper];
}

function buildHallProps(kit: Kit, scene: Scene, m: Mats, r: () => number): { stationMap: Mesh[]; umbrellas: Mesh[]; lostFound: Mesh[] } {
  const h = STATION.hall;
  // The station map, an enamel panel on the south wall.
  const mapMat = new StandardMaterial("stationMap", scene);
  mapMat.diffuseTexture = paint(scene, "tex:stationMap", 512, drawStationMap, false, true);
  mapMat.specularColor = new Color3(0.15, 0.15, 0.15);
  const map = MeshBuilder.CreatePlane("stationMap", { width: 4, height: 2.2 }, scene);
  map.position.set(438, h.floor + 2, h.z0 + 0.03);
  map.rotation.y = Math.PI;
  map.material = mapMat;
  map.receiveShadows = true;
  map.freezeWorldMatrix();
  const mapFrame = kit.box("stationMapFrame", 435.9, 440.1, h.floor + 0.85, h.floor + 3.15, h.z0, h.z0 + 0.02, m.steel, { keep: true, collide: false, cast: false });

  // The umbrella-lending rack by the gates, still full.
  const rack = new Form(scene, "umbrellaStand");
  const steel = m.steel;
  // Umbrella Stand photo: identical closed umbrellas in pale grey, hung in a row.
  const cloth = organic(scene, "umbrella-cloth", "#8e918b", "shell");
  const handle = organic(scene, "umbrella-handle", "#6b4a2e", "bark");
  const ux = 443, uz = h.z0 + 0.8;
  rack.box([ux, h.floor + 0.05, uz], [2.4, 0.1, 0.5], steel);
  rack.box([ux, h.floor + 0.9, uz + 0.12], [2.4, 0.06, 0.06], steel);
  for (const dx of [-1.15, 1.15]) rack.box([ux + dx, h.floor + 0.5, uz], [0.06, 1, 0.5], steel);
  for (let i = 0; i < 9; i++) {
    const x = ux - 1 + i * 0.25;
    const tilt = (r() - 0.5) * 0.08;
    rack.taper([[x, h.floor + 0.12, uz], [x + tilt, h.floor + 0.55, uz + 0.04], [x + tilt * 1.4, h.floor + 0.85, uz + 0.08]], 0.035, 0.07, cloth, 6);
    rack.taper([[x + tilt * 1.4, h.floor + 0.85, uz + 0.08], [x + tilt * 1.5, h.floor + 1.0, uz + 0.1], [x + tilt * 1.5 + 0.06, h.floor + 1.02, uz + 0.1]], 0.012, 0.012, handle, 4);
  }
  const umbrellas = rack.finish();
  for (const u of umbrellas) kit.add(u, u.material as StandardMaterial, { keep: true, collide: false, tile: undefined });

  // The lost-and-found shelf behind the office window, facing out into the hall (+x).
  const shelf = new Form(scene, "lostFound");
  const wood = organic(scene, "shelf-wood", "#6f5a40", "bark");
  const tag = organic(scene, "lostfound-tag", "#d9d0b8", "shell");
  const sx = 428.1, sz = -5;
  shelf.box([sx, h.floor + 1.2, sz], [0.08, 2.4, 3.2], wood);
  for (const y of [0.35, 1.0, 1.65, 2.3]) shelf.box([sx + 0.27, h.floor + y, sz], [0.5, 0.05, 3.2], wood);
  const things: [string, number, number, [number, number, number]][] = [
    ["#5d3a32", -1.1, 1.05, [0.12, 0.08, 0.22]], // glove
    ["#c8a23b", -0.3, 1.1, [0.14, 0.18, 0.14]], // toy
    ["#2a2c2e", 0.5, 1.03, [0.08, 0.04, 0.2]], // glasses
    ["#8b4a3a", 1.1, 1.75, [0.22, 0.18, 0.32]], // lunch box
    ["#5c6a7a", -0.8, 1.72, [0.22, 0.1, 0.5]], // scarf
    ["#3f3a33", 0.2, 0.42, [0.25, 0.2, 0.4]], // bag
    ["#8a8f78", -1.1, 2.37, [0.2, 0.12, 0.3]], // hat
  ];
  for (const [colour, dz, y, size] of things) {
    shelf.ellipsoid([sx + 0.3, h.floor + y + size[1] / 2, sz + dz], size, organic(scene, `lost-${colour}`, colour, "shell"), 6);
    shelf.box([sx + 0.52, h.floor + y + 0.02, sz + dz + 0.12], [0.01, 0.04, 0.08], tag);
  }
  const lostFound = shelf.finish();
  for (const p of lostFound) kit.add(p, p.material as StandardMaterial, { keep: true, collide: false, tile: undefined });
  return { stationMap: [map, mapFrame], umbrellas, lostFound };
}

// --- Escalators, platform, train, tunnel ---------------------------------------------------

function buildEscalators(kit: Kit, scene: Scene, m: Mats): void {
  const e = STATION.escalators;
  const h = STATION.hall;
  const p = STATION.platform;
  // Two stopped escalators side by side: steps on a ramp, with balustrades.
  for (const [z0, z1] of [[e.z0 + 0.4, 2.8], [3.2, e.z1 - 0.4]] as const) {
    stairs(kit, scene, "escalator", e.x1, e.x0, z0, z1, p.floor, h.floor, m.steel);
  }
  for (const z of [e.z0, 2.8, e.z1 - 0.4]) {
    kit.slope("escalatorBalustrade", new Vector3(e.x0 - 1, h.floor + 0.5, z + 0.2), new Vector3(e.x1 + 1, p.floor + 0.5, z + 0.2), 0.4, 1.2, m.steel);
    kit.slope("escalatorHandrail", new Vector3(e.x0 - 1, h.floor + 1.12, z + 0.2), new Vector3(e.x1 + 1, p.floor + 1.12, z + 0.2), 0.14, 0.08, m.dark, { collide: false, cast: false });
  }
  kit.box("escalatorUnder", e.x0, e.x1, p.floor - 1, p.floor, e.z0, e.z1, m.floor, { cast: false });
  // The shaft's walls and sloping ceiling.
  tiled(kit, "escalatorWallS", e.x0, e.x1, p.floor - 1, h.ceiling, e.z0 - 0.4, e.z0, m.tile);
  tiled(kit, "escalatorWallN", e.x0, e.x1, p.floor - 1, h.ceiling, e.z1, e.z1 + 0.4, m.tile);
  kit.slope("escalatorCeiling", new Vector3(e.x0, h.ceiling, (e.z0 + e.z1) / 2), new Vector3(e.x1, p.ceiling, (e.z0 + e.z1) / 2), e.z1 - e.z0 + 0.8, 0.8, m.ceiling, { collide: false });
  // Earth over the sloping ceiling, so no daylight leaks round its top edge.
  kit.box("escalatorEarth", e.x0, e.x1, h.ceiling, h.ceiling + 0.8, e.z0 - 0.4, e.z1 + 0.4, m.ceiling, { collide: false });
}

function buildPlatform(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const p = STATION.platform;
  const t = STATION.track;
  const tn = STATION.tunnel;
  const e = STATION.escalators;
  kit.box("platformFloor", p.x0, p.x1, p.floor - 1, p.floor, p.z0 - 0.6, t.z0, m.floor, { cast: false });
  tiled(kit, "platformEdge", p.x0, p.x1, p.floor - 0.02, p.floor + 0.01, t.z0 - 0.6, t.z0, m.edge, { collide: false, cast: false });
  kit.box("platformLip", p.x0, p.x1, t.bed, p.floor, t.z0 - 0.15, t.z0, m.concreteDark, { cast: false });
  // The track: ballast, sleepers and rails.
  kit.box("trackBed", p.x0, p.x1, t.bed - 1, t.bed, t.z0, t.z1, m.rubble, { cast: false });
  for (let x = p.x0 + 0.4; x < p.x1; x += 0.9) kit.box("sleeper", x, x + 0.25, t.bed, t.bed + 0.12, t.z0 + 0.6, t.z1 - 1.1, m.concreteDark, { collide: false, cast: false });
  for (const z of [8.1, 9.5]) kit.box("rail", p.x0, p.x1, t.bed + 0.12, t.bed + 0.28, z - 0.04, z + 0.04, m.rail, { collide: false, cast: false });
  // Walls: north beyond the track, south with the doors into the tunnel, and both ends.
  const top = p.ceiling;
  tiled(kit, "platformWallN", p.x0 - 0.4, p.x1 + 0.4, t.bed - 1, top, t.z1, t.z1 + 0.4, m.tile);
  const doors = STATION.tunnelDoors;
  const wallS = (x0: number, x1: number) => tiled(kit, "platformWallS", x0, x1, p.floor - 1, top, tn.z1, p.z0 - 0.6, m.tile);
  wallS(p.x0 - 0.4, doors[0].x0);
  wallS(doors[0].x1, doors[1].x0);
  wallS(doors[1].x1, p.x1 + 0.4);
  for (const d of doors) tiled(kit, "tunnelDoorHead", d.x0, d.x1, p.floor + 2.3, top, tn.z1, p.z0 - 0.6, m.tile);
  for (const [x0, x1] of [[p.x0 - 0.4, doors[0].x0], [doors[0].x1, doors[1].x0], [doors[1].x1, p.x1]] as const) tiled(kit, "platformBand", x0, x1, p.floor, p.floor + 1.2, p.z0 - 0.62, p.z0 - 0.6, m.tileGreen, { collide: false, cast: false });
  // West wall, with the escalators' mouth.
  tiled(kit, "platformWallW1", p.x0 - 0.4, p.x0, t.bed - 1, top, p.z0 - 0.6, e.z0 - 0.4, m.tile);
  tiled(kit, "platformWallW2", p.x0 - 0.4, p.x0, t.bed - 1, top, e.z1 + 0.4, t.z1, m.tile);
  // East wall: closed over the platform, open over the track (the tunnel mouth).
  tiled(kit, "platformWallE", p.x1, p.x1 + 0.4, p.floor - 1, top, p.z0 - 0.6, t.z0, m.tile);
  tiled(kit, "tunnelMouthHead", p.x1, p.x1 + 0.4, -9.6, top, t.z0, t.z1, m.concreteDark);
  kit.box("tunnelMouthDark", p.x1 + 4, p.x1 + 4.2, t.bed - 1, -9.6, t.z0, t.z1, m.dark, { cast: false, collide: false });
  for (const z of [t.z0, t.z1]) kit.box("tunnelMouthWall", p.x1, p.x1 + 4, t.bed - 1, -9.6, z === t.z0 ? z - 0.3 : z, z === t.z0 ? z : z + 0.3, m.concreteDark, { cast: false });
  kit.box("tunnelMouthRoof", p.x1, p.x1 + 4, -9.6, -9.2, t.z0 - 0.3, t.z1 + 0.3, m.concreteDark, { cast: false });
  // The west end of the track runs into a collapsed tunnel.
  kit.box("tunnelWestRubble", p.x0 - 3, p.x0, t.bed - 1, top, t.z0, t.z1, m.rubble);
  // Ceiling, with the two shafts open.
  slabWithHoles(kit, "platformCeiling", p.x0 - 0.4, p.x1 + 0.4, p.z0 - 0.6, t.z1 + 0.4, top, top + 1, STATION.shafts.slice(1), m.ceiling);
  // Two rows of square columns down the platform.
  for (let x = p.x0 + 6; x < p.x1 - 2; x += 9) {
    if (STATION.shafts.some((s) => x > s.x0 - 1.5 && x < s.x1 + 1.5)) continue;
    tiled(kit, "platformColumn", x - 0.4, x + 0.4, p.floor, top, 3.6, 4.4, m.tile);
  }
  // Maintenance steps down to the track at both ends, so nothing that falls in is stuck there.
  stairs(kit, scene, "trackStepsE", 551, 556, t.z0, t.z0 + 1.4, t.bed, p.floor, m.concreteDark);
  stairs(kit, scene, "trackStepsW", 472.6, 469, t.z0, t.z0 + 1.4, t.bed, p.floor, m.concreteDark);
  // Benches and a bin or two.
  for (const x of [474, 503, 520, 546]) {
    kit.box("platformBench", x - 1, x + 1, p.floor + 0.42, p.floor + 0.5, -1.4, -0.9, m.rust, { collide: false });
    for (const dx of [-0.8, 0.8]) kit.box("platformBenchLeg", x + dx - 0.05, x + dx + 0.05, p.floor, p.floor + 0.42, -1.3, -1, m.steel, { collide: false, cast: false });
  }
  // The roof of the front carriage is reached up a fallen ceiling slab.
  kit.slope("fallenSlab", new Vector3(481.2, p.floor, -0.2), new Vector3(481.2, STATION.train.roof + 0.05, 8.2), 2.4, 0.4, m.concreteDark);
  kit.box("fallenSlabFoot", 479.6, 482.8, p.floor, p.floor + 0.25, -0.9, 0.2, m.rubble, { collide: false });
  kit.box("ceilingScar", 479.8, 482.6, top - 0.02, top, 0, 8, m.dark, { collide: false, cast: false });
  // Debris along the platform.
  for (let i = 0; i < 26; i++) {
    const s = 0.18 + r() * 0.4;
    const rock = MeshBuilder.CreateBox("platformDebris", { width: s * 1.6, height: s * 0.5, depth: s }, scene);
    rock.position.set(p.x0 + 3 + r() * 88, p.floor + s * 0.2, p.z0 + r() * 9.5);
    rock.rotation.set(r() * 0.3, r() * 3, r() * 0.3);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }
}

function buildTrain(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const tr = STATION.train;
  const floor = STATION.platform.floor;
  const doorsAt = [3.4, 10.25, 17.1];
  for (const [ci, [a, b]] of STATION.cars.entries()) {
    kit.box("carFloor", a, b, floor - 1.0, floor, tr.z0, tr.z1, m.concreteDark, { cast: false });
    kit.box("carUnder", a + 1.5, b - 1.5, STATION.track.bed + 0.3, floor - 1.0, tr.z0 + 0.4, tr.z1 - 0.4, m.rust, { collide: false });
    tiled(kit, "carRoof", a, b, tr.roof - 0.3, tr.roof, tr.z0, tr.z1, m.carRoof);
    tiled(kit, "carSideN", a, b, floor, tr.roof - 0.3, tr.z1 - 0.2, tr.z1, m.carSide);
    // Platform side, with three open doors.
    let x = a;
    for (const d of doorsAt) {
      tiled(kit, "carSideS", x, a + d - 0.7, floor, tr.roof - 0.3, tr.z0, tr.z0 + 0.2, m.carSide);
      tiled(kit, "carDoorHead", a + d - 0.7, a + d + 0.7, floor + 2.1, tr.roof - 0.3, tr.z0, tr.z0 + 0.2, m.carSide);
      x = a + d + 0.7;
    }
    tiled(kit, "carSideS", x, b, floor, tr.roof - 0.3, tr.z0, tr.z0 + 0.2, m.carSide);
    // Ends: a gangway door between cars; the cab end at the front is closed.
    for (const [end, x0, x1] of [["W", a, a + 0.2], ["E", b - 0.2, b]] as const) {
      const outer = (ci === 0 && end === "W") || (ci === STATION.cars.length - 1 && end === "E");
      if (outer) {
        tiled(kit, "carEnd", x0, x1, floor, tr.roof - 0.3, tr.z0, tr.z1, m.carSide);
      } else {
        tiled(kit, "carEnd", x0, x1, floor, tr.roof - 0.3, tr.z0, 8.3, m.carSide);
        tiled(kit, "carEnd", x0, x1, floor, tr.roof - 0.3, 9.3, tr.z1, m.carSide);
        tiled(kit, "carEnd", x0, x1, floor + 2.1, tr.roof - 0.3, 8.3, 9.3, m.carSide);
      }
    }
    // Long seats along the north side, and grab poles.
    for (let s = a + 1; s < b - 1; s += 6.85) {
      kit.box("carSeat", s, Math.min(s + 5, b - 0.5), floor + 0.25, floor + 0.48, tr.z1 - 0.75, tr.z1 - 0.2, m.seat, { collide: false });
      kit.box("carSeatBack", s, Math.min(s + 5, b - 0.5), floor + 0.48, floor + 1.05, tr.z1 - 0.32, tr.z1 - 0.2, m.seat, { collide: false });
    }
    for (const d of doorsAt) kit.box("carPole", a + d - 0.03, a + d + 0.03, floor, tr.roof - 0.3, 9.27, 9.33, m.steel, { collide: false, cast: false });
    // The gangway to the next car: floor, walls and a roof plate to walk across on top.
    if (ci < STATION.cars.length - 1) {
      const nx = STATION.cars[ci + 1][0];
      kit.box("gangwayFloor", b, nx, floor - 0.3, floor, 8.3, 9.3, m.rust, { cast: false });
      kit.box("gangwayWallS", b, nx, floor, floor + 2.1, 8.15, 8.3, m.dark);
      kit.box("gangwayWallN", b, nx, floor, floor + 2.1, 9.3, 9.45, m.dark);
      kit.box("gangwayRoof", b - 0.1, nx + 0.1, tr.roof - 0.3, tr.roof - 0.02, tr.z0 + 0.4, tr.z1 - 0.4, m.rust);
    }
  }
  // The cab: a sloped front with dark windows.
  const [a] = STATION.cars[0];
  kit.box("trainCab", a - 1.2, a, floor - 0.6, tr.roof - 0.6, tr.z0 + 0.2, tr.z1 - 0.2, m.carSide, { tile: 5 });
  kit.box("trainCabGlass", a - 1.25, a - 1.2, floor + 1.2, tr.roof - 0.9, tr.z0 + 0.5, tr.z1 - 0.5, m.dark, { collide: false, cast: false });
  // Moss along the roof edges.
  const moss = organic(scene, "train-moss", "#3a4529", "moss");
  for (let i = 0; i < 18; i++) {
    const x0 = tr.x0 + r() * 60;
    const z0 = r() < 0.5 ? tr.z0 : tr.z1 - 0.45;
    kit.box("trainMoss", x0, x0 + 1 + r() * 3, tr.roof - 0.02, tr.roof + 0.05, z0, z0 + 0.45, moss, { collide: false, cast: false, tile: 1 });
  }
}

function buildTunnel(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const tn = STATION.tunnel;
  const p = STATION.platform;
  const d = STATION.den;
  kit.box("tunnelFloor", tn.x0, tn.x1, p.floor - 1, p.floor, tn.z0, tn.z1, m.floor, { cast: false });
  kit.box("denFloor", d.x0, d.x1, p.floor - 1, p.floor, d.z0, tn.z0, m.dirt, { cast: false });
  kit.box("tunnelCeiling", tn.x0 - 0.4, tn.x1 + 0.4, tn.ceiling, tn.ceiling + 0.6, d.z0 - 0.4, tn.z1, m.ceiling);
  kit.box("tunnelWallS1", tn.x0 - 0.4, d.x0, p.floor - 1, tn.ceiling, tn.z0 - 0.4, tn.z0, m.concreteDark);
  kit.box("tunnelWallS2", d.x1, tn.x1 + 0.4, p.floor - 1, tn.ceiling, tn.z0 - 0.4, tn.z0, m.concreteDark);
  kit.box("denWallS", d.x0, d.x1, p.floor - 1, tn.ceiling, d.z0 - 0.4, d.z0, m.rubble);
  kit.box("denWallW", d.x0 - 0.4, d.x0, p.floor - 1, tn.ceiling, d.z0 - 0.4, tn.z0, m.concreteDark);
  kit.box("denWallE", d.x1, d.x1 + 0.4, p.floor - 1, tn.ceiling, d.z0 - 0.4, tn.z0, m.concreteDark);
  kit.box("tunnelEnd", tn.x0 - 0.4, tn.x0, p.floor - 1, tn.ceiling, tn.z0, tn.z1, m.concreteDark);
  // The east end: a service door, blown out, on into the corridor to Tower Foot (see towerFoot.ts).
  kit.box("tunnelDoorJamb", tn.x1, tn.x1 + 0.4, p.floor, tn.ceiling, tn.z0, tn.z0 + 0.4, m.concreteDark);
  kit.box("tunnelDoorJamb", tn.x1, tn.x1 + 0.4, p.floor, tn.ceiling, tn.z1 - 0.4, tn.z1, m.concreteDark);
  kit.box("tunnelDoorHead", tn.x1, tn.x1 + 0.4, p.floor + 2.4, tn.ceiling, tn.z0, tn.z1, m.concreteDark);
  // Cable trays and pipes along the north wall.
  for (const y of [-11.4, -11.9]) kit.box("cableTray", tn.x0, tn.x1, y, y + 0.06, tn.z1 - 0.45, tn.z1, m.rust, { collide: false, cast: false });
  kit.box("tunnelPipe", tn.x0, tn.x1, -12.6, -12.35, tn.z0 + 0.05, tn.z0 + 0.3, m.rust, { collide: false, cast: false });
  // The hound's den: a nest of gnawed debris and dry leaves.
  for (let i = 0; i < 18; i++) {
    const s = 0.15 + r() * 0.35;
    const bit = MeshBuilder.CreateBox("denDebris", { width: s * 1.8, height: s * 0.4, depth: s }, scene);
    const a = r() * Math.PI * 2, dd = 1.5 + r() * 2.5;
    bit.position.set((d.x0 + d.x1) / 2 + Math.cos(a) * dd, p.floor + s * 0.15, d.z0 + 1.8 + Math.sin(a) * dd * 0.5);
    bit.rotation.set(r() * 0.3, r() * 3, r() * 0.3);
    kit.add(bit, r() < 0.5 ? m.rubble : m.dirt, { collide: false, cast: false, tile: 1 });
  }
  kit.box("denBedding", d.x0 + 3, d.x1 - 3, p.floor, p.floor + 0.12, d.z0 + 0.8, d.z0 + 2.8, m.dirt, { collide: false, cast: false });
}

/** Light shafts: walls up to the street, rubble mounds below, beams of dusty light. Returns the beams. */
function buildShafts(kit: Kit, scene: Scene, m: Mats, r: () => number): Mesh[] {
  const beamMat = new StandardMaterial("shaftBeamHaze", scene);
  beamMat.emissiveColor = new Color3(0.75, 0.72, 0.6);
  beamMat.disableLighting = true;
  beamMat.alpha = 0.06;
  beamMat.backFaceCulling = false;
  const beams: Mesh[] = [];
  for (const [i, s] of STATION.shafts.entries()) {
    const ceiling = i === 0 ? STATION.hall.ceiling : STATION.platform.ceiling;
    const floor = i === 0 ? STATION.hall.floor : STATION.platform.floor;
    const top = STATION.surface;
    // Broken shaft walls, ragged at the top.
    for (const [x0, x1, z0, z1] of [
      [s.x0 - 0.5, s.x1 + 0.5, s.z0 - 0.5, s.z0],
      [s.x0 - 0.5, s.x1 + 0.5, s.z1, s.z1 + 0.5],
      [s.x0 - 0.5, s.x0, s.z0, s.z1],
      [s.x1, s.x1 + 0.5, s.z0, s.z1],
    ] as const) kit.box("shaftWall", x0, x1, ceiling, top - r() * 1.2, z0, z1, m.rubble, { cast: true, collide: false });
    // The fallen street below, now a mound of earth.
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    const mound = MeshBuilder.CreateSphere("shaftMound", { diameter: 1, segments: 10 }, scene);
    mound.scaling.set(s.x1 - s.x0 + 1.5, 0.9, s.z1 - s.z0 + 1.5);
    mound.position.set(cx, floor, cz);
    kit.add(mound, m.dirt, { collide: false, cast: false, tile: 2 });
    const beam = MeshBuilder.CreateBox("shaftBeamHaze", { width: s.x1 - s.x0 - 0.4, height: top - floor, depth: s.z1 - s.z0 - 0.4 }, scene);
    beam.position.set(cx, (top + floor) / 2, cz);
    beam.material = beamMat;
    beam.isPickable = false;
    beam.freezeWorldMatrix();
    beams.push(beam);
  }
  // Earth around the shafts' tops, so the street above isn't an open void at the rim.
  for (const s of STATION.shafts) kit.box("shaftRim", s.x0 - 3, s.x1 + 3, STATION.surface - 0.6, STATION.surface - 0.3, s.z0 - 3, s.z1 + 3, m.dirt, { collide: false });
  return beams;
}

function buildCharger(kit: Kit, scene: Scene, m: Mats): Mesh[] {
  const p = STATION.platform;
  const f = new Form(scene, "predecessorCharger");
  const shell = organic(scene, "charger-shell", "#d6d3c8", "shell");
  const graphite = organic(scene, "charger-graphite", "#3a3d40", "shell");
  const cable = organic(scene, "charger-cable", "#1e1f20", "shell");
  const x = p.x1 - 0.25, z = 0.5, y = p.floor;
  // A wall-mounted cradle: back plate, a worn seat and two arms.
  f.box([x - 0.06, y + 1.2, z], [0.12, 1.6, 1.1], graphite);
  f.box([x - 0.4, y + 0.55, z], [0.7, 0.12, 0.9], shell);
  for (const dz of [-0.48, 0.48]) f.box([x - 0.3, y + 1.0, z + dz], [0.5, 0.7, 0.08], shell);
  f.box([x - 0.12, y + 1.75, z], [0.2, 0.3, 0.5], shell);
  // The cable, spliced into the old conduit by hand.
  f.taper([[x - 0.05, y + 2.0, z + 0.3], [x - 0.1, y + 2.6, z + 0.9], [x - 0.05, y + 3.4, z + 1.6], [x - 0.02, y + 4.4, z + 1.7]], 0.04, 0.04, cable, 5);
  f.box([x - 0.05, y + 4.6, z + 1.7], [0.1, 0.4, 0.3], graphite);
  for (let i = 0; i < 4; i++) f.taper([[x - 0.06, y + 4.35 + i * 0.05, z + 1.55], [x - 0.12, y + 4.4 + i * 0.05, z + 1.85]], 0.012, 0.012, i % 2 ? shell : cable, 4);
  const parts = f.finish();
  for (const part of parts) kit.add(part, part.material as StandardMaterial, { keep: true, collide: false, tile: undefined });
  // One dim cyan status light: the only machine light down here.
  const led = MeshBuilder.CreateSphere("chargerLed", { diameter: 0.05, segments: 4 }, scene);
  led.position.set(x - 0.23, y + 1.75, z + 0.18);
  const ledMat = new StandardMaterial("chargerLed", scene);
  ledMat.emissiveColor = new Color3(0.1, 0.35, 0.42);
  ledMat.disableLighting = true;
  led.material = ledMat;
  led.isPickable = false;
  void m;
  return parts;
}

/** A braided column of pale roots from the street above down to the platform, spreading over a mound of soil. */
function buildRootColumn(kit: Kit, scene: Scene, r: () => number): Mesh[] {
  const c = STATION.rootColumn;
  const f = new Form(scene, "rootColumn");
  const bark = organic(scene, "root-column", "#b9ad92", "bark");
  const dark = organic(scene, "root-column-dark", "#8d8068", "bark");
  const top = STATION.surface + 1;
  for (let i = 0; i < 14; i++) {
    const a0 = (i / 14) * Math.PI * 2;
    const twist = 1.4 + r() * 0.8;
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const y = top + (c.y - top) * t;
      // Tight in the middle, flaring at the foot where the roots spread out over the mound.
      const rad = 0.45 + 0.12 * Math.sin(t * 9 + i) + (t > 0.8 ? (t - 0.8) * 9 : 0) + (t < 0.15 ? (0.15 - t) * 6 : 0);
      const a = a0 + t * twist;
      pts.push([c.x + Math.cos(a) * rad, y + (t === 1 ? 0.1 : 0), c.z + Math.sin(a) * rad]);
    }
    f.taper(pts, 0.26 + r() * 0.08, 0.1, i % 3 ? bark : dark, 6);
  }
  // Thin roots trailing off the column.
  for (let i = 0; i < 10; i++) {
    const y = -9 + r() * 8;
    const a = r() * Math.PI * 2, len = 0.8 + r() * 1.6;
    f.taper([[c.x + Math.cos(a) * 0.4, y, c.z + Math.sin(a) * 0.4], [c.x + Math.cos(a) * (0.4 + len * 0.6), y - len * 0.5, c.z + Math.sin(a) * (0.4 + len * 0.6)], [c.x + Math.cos(a) * (0.4 + len * 0.7), y - len * 1.2, c.z + Math.sin(a) * (0.4 + len * 0.7)]], 0.04, 0.01, bark, 4);
  }
  const parts = f.finish();
  for (const part of parts) kit.add(part, part.material as StandardMaterial, { keep: true, collide: false, tile: undefined });
  // The column's core blocks the robot.
  const core = MeshBuilder.CreateCylinder("rootColumnCore", { diameter: 1.3, height: 6, tessellation: 8 }, scene);
  core.position.set(c.x, c.y + 3, c.z);
  kit.add(core, bark, { collide: true, cast: false, hidden: true });
  return parts;
}

/** Still drip pools: thin sheets of dark water in hollows of the floor. */
function buildPools(kit: Kit, scene: Scene, m: Mats): void {
  const water = new StandardMaterial("dripPool", scene);
  water.diffuseColor = new Color3(0.05, 0.06, 0.06);
  water.specularColor = new Color3(0.45, 0.45, 0.42);
  water.specularPower = 128;
  for (const pool of STATION.pools) {
    const disc = MeshBuilder.CreateDisc("dripPool", { radius: pool.r, tessellation: 18 }, scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(pool.x, STATION.platform.floor + 0.025, pool.z);
    kit.add(disc, water, { collide: false, cast: false });
    // A rim of silt round each pool.
    const rim = MeshBuilder.CreateTorus("dripPoolRim", { diameter: pool.r * 2 + 0.1, thickness: 0.18, tessellation: 18 }, scene);
    rim.scaling.y = 0.25;
    rim.position.set(pool.x, STATION.platform.floor + 0.01, pool.z);
    kit.add(rim, m.dirt, { collide: false, cast: false, tile: 1 });
  }
}

/** Mud-cup swift nests along the arch over the east tunnel mouth. */
function buildNests(kit: Kit, scene: Scene, m: Mats, r: () => number): Vector3[] {
  const p = STATION.platform;
  const t = STATION.track;
  const nests: Vector3[] = [];
  for (let i = 0; i < 9; i++) {
    const z = t.z0 + 0.5 + i * ((t.z1 - t.z0 - 1) / 8);
    const y = -9.3 + (r() - 0.5) * 0.25;
    const cup = MeshBuilder.CreateSphere("swiftNest", { diameter: 0.34, segments: 6, slice: 0.5 }, scene);
    cup.rotation.x = Math.PI;
    cup.position.set(p.x1 - 0.08, y, z);
    kit.add(cup, m.dirt, { collide: false, cast: false, tile: 0.5 });
    nests.push(new Vector3(p.x1 - 0.22, y + 0.06, z));
  }
  return nests;
}

function buildPlants(scene: Scene, r: () => number): void {
  // Ferns and grass only where the light reaches, and moss on the mounds.
  const grass = card(scene, "grassTuft");
  const tufts: { x: number; y: number; z: number; s: number }[] = [];
  for (const [i, s] of STATION.shafts.entries()) {
    const floor = i === 0 ? STATION.hall.floor : STATION.platform.floor;
    for (let k = 0; k < 10; k++) tufts.push({ x: s.x0 + r() * (s.x1 - s.x0), y: floor + 0.2, z: s.z0 + r() * (s.z1 - s.z0), s: 0.5 + r() * 0.5 });
    // A few on the shaft rims high up.
    for (let k = 0; k < 6; k++) tufts.push({ x: s.x0 - 0.5 + r() * (s.x1 - s.x0 + 1), y: STATION.surface - 0.3, z: r() < 0.5 ? s.z0 - 0.6 : s.z1 + 0.6, s: 0.8 + r() * 0.6 });
  }
  scatterCards(scene, "stationTufts", grass, 0.8, 0.55, 2, tufts, r);
  // Vines hanging down the shaft walls.
  const vine = card(scene, "vine");
  const cards: Mesh[] = [];
  for (const [i, s] of STATION.shafts.entries()) {
    const ceiling = i === 0 ? STATION.hall.ceiling : STATION.platform.ceiling;
    for (let k = 0; k < 4; k++) {
      const len = 2.5 + r() * (STATION.surface - ceiling);
      const p = MeshBuilder.CreatePlane("shaftVine", { width: 1 + r(), height: len }, scene);
      const side = k % 4;
      p.position.set(side === 0 ? s.x0 + 0.05 : side === 1 ? s.x1 - 0.05 : s.x0 + 0.5 + r() * (s.x1 - s.x0 - 1), STATION.surface - 0.3 - len / 2, side === 2 ? s.z0 + 0.05 : side === 3 ? s.z1 - 0.05 : s.z0 + 0.5 + r() * (s.z1 - s.z0 - 1));
      p.rotation.y = side < 2 ? Math.PI / 2 : 0;
      p.bakeCurrentTransformIntoVertices();
      cards.push(p);
    }
  }
  const vines = Mesh.MergeMeshes(cards, true)!;
  vines.name = "stationVines";
  vines.material = vine;
  vines.isPickable = false;
  vines.freezeWorldMatrix();
}

// --- Painted textures -------------------------------------------------------------------

/** Glazed wall tiles, grimy, with mineral streaks running down. */
function drawTiles(base: [number, number, number]) {
  return (c: Ctx, s: number, r: () => number) => {
    const [R, G, B] = base;
    c.fillStyle = `rgb(${R - 40},${G - 40},${B - 40})`;
    c.fillRect(0, 0, s, s);
    const n = 16;
    const w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = (r() - 0.5) * 18;
      c.fillStyle = `rgb(${R + v},${G + v},${B + v})`;
      c.fillRect(x * w + 1, y * w + 1, w - 2, w - 2);
      if (r() < 0.04) {
        c.fillStyle = "rgba(40,38,32,0.6)";
        c.fillRect(x * w + 1, y * w + 1, w - 2, w - 2);
      }
    }
    // Streaks and grime.
    for (let i = 0; i < 26; i++) {
      const x = r() * s, len = s * (0.2 + r() * 0.8);
      const g = c.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(${r() < 0.5 ? "120,96,60" : "70,72,60"},0.35)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(x, 0, 2 + r() * 6, len);
    }
    for (let i = 0; i < 700; i++) {
      c.fillStyle = `rgba(30,30,26,${r() * 0.12})`;
      c.fillRect(r() * s, r() * s, 1 + r() * 4, 1 + r() * 4);
    }
  };
}

function drawPlatformEdge(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#8f8257";
  c.fillRect(0, 0, s, s);
  for (let y = 4; y < s; y += 12) for (let x = 4; x < s; x += 12) {
    c.fillStyle = "#a69863";
    c.beginPath();
    c.arc(x + 2, y + 2, 3, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 300; i++) {
    c.fillStyle = `rgba(40,36,26,${r() * 0.25})`;
    c.fillRect(r() * s, r() * s, 2 + r() * 6, 2 + r() * 6);
  }
}

/** Five metres of carriage side: off-white, a faded green stripe, a dark window. */
function drawTrainSide(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#b8b5aa";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#5b7a62";
  c.fillRect(0, s * 0.72, s, s * 0.07);
  c.fillStyle = "#3b4a3f";
  c.fillRect(0, s * 0.8, s, s * 0.02);
  c.fillStyle = "#141819";
  c.fillRect(s * 0.12, s * 0.18, s * 0.76, s * 0.34);
  c.fillStyle = "rgba(160,170,170,0.12)";
  c.fillRect(s * 0.14, s * 0.2, s * 0.25, s * 0.12);
  for (let i = 0; i < 40; i++) {
    const x = r() * s;
    const g = c.createLinearGradient(0, s * 0.52, 0, s);
    g.addColorStop(0, "rgba(90,74,50,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x, s * 0.52, 2 + r() * 5, s * 0.48);
  }
  for (let i = 0; i < 500; i++) {
    c.fillStyle = `rgba(60,58,50,${r() * 0.15})`;
    c.fillRect(r() * s, r() * s, 1 + r() * 4, 1 + r() * 4);
  }
}

function drawTrainRoof(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#6f716c";
  c.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 16) {
    c.fillStyle = "rgba(30,30,28,0.35)";
    c.fillRect(x, 0, 2, s);
  }
  for (let i = 0; i < 200; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "70,84,48" : "90,70,50"},${r() * 0.4})`;
    c.fillRect(r() * s, r() * s, 2 + r() * 10, 2 + r() * 10);
  }
}

function drawWayfinding(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#2f4a5a";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#d8d3c4";
  // An arrow and a train pictogram, no words.
  c.beginPath();
  c.moveTo(s * 0.08, s * 0.5);
  c.lineTo(s * 0.2, s * 0.3);
  c.lineTo(s * 0.2, s * 0.42);
  c.lineTo(s * 0.32, s * 0.42);
  c.lineTo(s * 0.32, s * 0.58);
  c.lineTo(s * 0.2, s * 0.58);
  c.lineTo(s * 0.2, s * 0.7);
  c.closePath();
  c.fill();
  c.fillRect(s * 0.45, s * 0.3, s * 0.3, s * 0.3);
  c.fillStyle = "#2f4a5a";
  c.fillRect(s * 0.49, s * 0.34, s * 0.22, s * 0.1);
  c.fillStyle = "#d8d3c4";
  for (const x of [0.5, 0.68]) {
    c.beginPath();
    c.arc(s * x, s * 0.64, s * 0.03, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 400; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "20,30,30" : "200,190,170"}, ${0.06 + r() * 0.16})`;
    c.fillRect(r() * s, r() * s, 2 + r() * 8, 2 + r() * 5);
  }
}

/** Ticket Machine photo: a cream cabinet with green panels, a dark screen, a key column and a coin tray. */
function drawMachineFace(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#cbc3ab";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#4f7a62";
  c.fillRect(0, s * 0.02, s, s * 0.05);
  c.fillRect(0, s * 0.9, s, s * 0.1);
  // Fare chart, dead screen, buttons, coin tray, ticket slot.
  c.fillStyle = "#e1dac4";
  c.fillRect(s * 0.12, s * 0.09, s * 0.76, s * 0.13);
  c.fillStyle = "rgba(60,60,60,0.5)";
  for (let i = 0; i < 5; i++) c.fillRect(s * 0.16, s * (0.11 + i * 0.022), s * (0.3 + r() * 0.35), 2);
  c.fillStyle = "#101314";
  c.fillRect(s * 0.14, s * 0.28, s * 0.52, s * 0.26);
  c.fillStyle = "#8d8a7e";
  for (let i = 0; i < 8; i++) c.fillRect(s * (0.72 + (i % 2) * 0.09), s * (0.29 + Math.floor(i / 2) * 0.06), s * 0.07, s * 0.045);
  c.fillStyle = "#2a2c2b";
  c.fillRect(s * 0.6, s * 0.6, s * 0.18, s * 0.025);
  c.fillRect(s * 0.2, s * 0.68, s * 0.34, s * 0.12);
  for (let i = 0; i < 600; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "70,58,40" : "120,118,100"},${r() * 0.22})`;
    c.fillRect(r() * s, r() * s, 1 + r() * 5, 1 + r() * 5);
  }
}

/** The departure board, dark split flaps; only the last line still shows. */
function drawDepartureBoard(c: Ctx, s: number, r: () => number): void {
  // Drawn in a 6:1.1 strip and stretched to fill the square texture (the board's plane is 6 × 1.1 m).
  const h = s * (1.1 / 6);
  c.save();
  c.scale(1, 6 / 1.1);
  c.fillStyle = "#0d0f10";
  c.fillRect(0, 0, s, h);
  const rows = 4;
  const rh = h / rows;
  for (let i = 0; i < rows; i++) {
    for (let x = 4; x < s - 4; x += 12) {
      c.fillStyle = "#1a1d1e";
      c.fillRect(x, i * rh + 3, 10, rh - 6);
    }
  }
  c.fillStyle = "#d9b45a";
  c.font = `bold ${Math.round(rh * 0.85)}px sans-serif`;
  c.textBaseline = "middle";
  c.fillText("EVACUATION   ALL STATIONS", s * 0.04, 3.5 * rh, s * 0.92);
  c.fillStyle = "rgba(13,15,16,0.45)";
  for (let x = 4; x < s; x += 12) c.fillRect(x + 10, 3 * rh, 2, rh);
  // Dust over everything.
  for (let i = 0; i < 300; i++) {
    c.fillStyle = `rgba(120,110,90,${r() * 0.15})`;
    c.fillRect(r() * s, r() * h, 1 + r() * 4, 1 + r() * 3);
  }
  c.restore();
}

function drawNotices(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#4a4c48";
  c.fillRect(0, 0, s, s);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
    const x = s * (0.04 + col * 0.24), y = s * (0.06 + row * 0.46);
    c.fillStyle = r() < 0.5 ? "#d9d1bb" : "#cfc6ac";
    c.fillRect(x, y, s * 0.2, s * 0.4);
    c.fillStyle = "rgba(40,40,40,0.55)";
    c.fillRect(x + s * 0.02, y + s * 0.03, s * 0.16, s * 0.035);
    for (let k = 0; k < 9; k++) c.fillRect(x + s * 0.02, y + s * (0.1 + k * 0.03), s * (0.08 + r() * 0.08), 2);
    c.fillStyle = "rgba(150,60,40,0.6)";
    c.fillRect(x + s * 0.02, y + s * 0.34, s * 0.06, s * 0.03);
  }
}

/** A fictional metro network: coloured lines, station dots, all but one scratched through. */
function drawStationMap(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#d7d0bc";
  c.fillRect(0, 0, s, s);
  const colours = ["#a9554a", "#4f7a9a", "#6c8c4c", "#b48a3a", "#7a5a8a"];
  const here = { x: s * 0.52, y: s * 0.5 };
  for (const [i, col] of colours.entries()) {
    c.strokeStyle = col;
    c.lineWidth = 7;
    c.beginPath();
    let x = s * (0.05 + r() * 0.1), y = s * (0.15 + i * 0.16);
    c.moveTo(x, y);
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += s * (0.12 + r() * 0.05);
      y = k === 2 ? here.y : y + (r() - 0.5) * s * 0.15;
      if (k === 2) x = here.x;
      c.lineTo(x, y);
      pts.push([x, y]);
    }
    c.stroke();
    for (const [px, py] of pts) {
      c.fillStyle = "#f2ecda";
      c.strokeStyle = "#2a2a2a";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, 6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (Math.hypot(px - here.x, py - here.y) > 4) {
        c.strokeStyle = "rgba(40,30,20,0.8)";
        c.beginPath();
        c.moveTo(px - 9, py - 9);
        c.lineTo(px + 9, py + 9);
        c.stroke();
      }
    }
  }
  c.strokeStyle = "rgba(150,40,30,0.85)";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(here.x, here.y, 16, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 30; i++) {
    const x = r() * s;
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "rgba(120,96,60,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x, 0, 2 + r() * 5, s * (0.3 + r() * 0.7));
  }
}
