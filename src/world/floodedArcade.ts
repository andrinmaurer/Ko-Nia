import { Color3, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, Vector3 } from "../babylon";
import { Kit, scatterCards, stairs } from "./kit";
import { buildRelayModel } from "./relay";
import { card, paint, rng, type Ctx } from "./textures";
import { Form, organic } from "./life/visuals";

/**
 * Block 3, the Flooded Arcade: a glass-roofed shopping street at the foot of the
 * temple hill, flooded knee-deep. Layout and content follow
 * docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md.
 *
 *   x 282..289  entrance landing (dry), below the west building's stairwell
 *   x 289..334  west half of the arcade: shops north and south, water in the street
 *   x 334..346  the Clock Crossing: a canal runs across the arcade, deep except
 *               where the arcade street crosses it (the eel's shallows)
 *   x 346..398  east half, ending at the flooded metro entrance
 *
 * The shop roofs (y 7), the arcade roof's tie beams and the eave girders over the
 * crossing are the dry high route.
 */
export const ARCADE = {
  x0: 282,
  x1: 398,
  z0: -6,
  z1: 44,
  street: { z0: 14, z1: 24 },
  shopsS: { z0: 6, z1: 14 },
  shopsN: { z0: 24, z1: 32 },
  /** Top of the shop roofs. */
  roof: 7,
  /** Water surface; the street is at 0. */
  water: 0.5,
  landing: { x0: 282, x1: 289, y: 1 },
  crossing: { x0: 334, x1: 346 },
  canal: { x0: 336, x1: 344, z0: -4, z1: 42, bed: -3 },
  /** The eel's shallows: where the arcade street crosses the canal. */
  shallows: { x0: 336, x1: 344, z0: 14, z1: 24, bed: -0.15 },
  station: { x0: 386, x1: 394, z0: 16, z1: 22 },
  mudBank: { x0: 374, x1: 386, z0: 15.5, z1: 22.5, y: 0.6 },
  clock: new Vector3(340, 5.3, 19),
  floodPillar: { x0: 346, x1: 347.8, z0: 14.1, z1: 15.9 },
};

/** Arcade street axis. */
export const ARCADE_AXIS = (ARCADE.street.z0 + ARCADE.street.z1) / 2;

export type WaterState = "dry" | "wade" | "deep";

/** Whether the robot at `p` (feet) is out of the water, wading, or in over its head. */
export function waterAt(p: Vector3): WaterState {
  if (p.x < ARCADE.landing.x1 - 0.5 || p.x > ARCADE.x1 || p.z < ARCADE.z0 || p.z > ARCADE.z1) return "dry";
  if (p.y > ARCADE.water - 0.05) return "dry";
  return p.y < -0.8 ? "deep" : "wade";
}

export interface FloodedArcade {
  relayStation: Mesh;
  relayGlow: StandardMaterial;
  spawn: Vector3;
  spawnYaw: number;
  /** Separate meshes the discovery code makes scannable. */
  clock: Mesh[];
  floodLine: Mesh[];
  shutter: Mesh[];
  bikeRack: Mesh[];
  toyBoat: Mesh[];
  tracks: Mesh[];
  /** Mossy shutters: the first one has been pulled open by the moss. */
  mossShutters: { mesh: Mesh; pulled: boolean }[];
  /** Fallen roof glass in the water, where the reeds root. */
  glassPiles: Vector3[];
  /** Open shop counters standing out of the water (mudskippers climb them). */
  counters: Vector3[];
}

type Mats = Record<string, StandardMaterial>;

/** Still, silty flood water: much darker than the rain puddles, so the street floor is only a hint. */
function murkyWater(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("arcadeWater", scene);
  m.diffuseColor = new Color3(0.1, 0.13, 0.09);
  m.specularColor = new Color3(0.32, 0.32, 0.3);
  m.specularPower = 96;
  m.alpha = 0.88;
  return m;
}

export function buildFloodedArcade(scene: Scene, shadows: ShadowGenerator): FloodedArcade {
  const kit = new Kit(scene, shadows);
  const r = rng(8821);
  const glass = kit.flat("arcadeGlass", 0.55, 0.68, 0.66, 0.6);
  glass.alpha = 0.22;
  glass.backFaceCulling = false;
  const steel = kit.flat("arcadeSteel", 0.2, 0.22, 0.22, 0.25);
  const steelTex = scene.getMaterialByName("surface:rust") as StandardMaterial | null;
  const m: Mats = {
    paving: kit.tex("sidewalk", 3),
    stone: kit.tex("stone", 2),
    concrete: kit.tex("concrete", 4),
    concreteDark: kit.tex("concreteDark", 4),
    rubble: kit.tex("rubble", 3),
    dirt: kit.tex("dirt", 5),
    facadeA: kit.tex("facadeLight", 8, 6.4),
    facadeB: kit.tex("facadeWarm", 8, 6.4),
    facadeC: kit.tex("facadeDark", 8, 6.4),
    plaster: kit.tex("plaster", 3),
    shutter: kit.tex("shutter", 3),
    wood: kit.tex("wood", 3),
    roof: kit.tex("roof", 5),
    rust: kit.tex("rust", 2),
    grass: kit.tex("grass", 2),
    leaves: kit.tex("leaves", 3),
    solar: kit.tex("solar", 1.5),
    metal: kit.flat("metal", 0.35, 0.37, 0.4, 0.3),
    roofSlab: kit.tex("concreteDark", 4),
    glass,
    steel,
    water: murkyWater(scene),
  };
  if (steelTex) steel.diffuseTexture = steelTex.diffuseTexture;

  buildGround(kit, scene, m);
  const shops = buildShops(kit, scene, m, r);
  buildRoof(kit, scene, m, r);
  const clock = buildClock(kit, scene, m);
  const floodLine = buildFloodPillar(kit, scene, m);
  const station = buildStationEntrance(kit, scene, m, r);
  const props = buildProps(kit, scene, m, r);
  buildBackdrop(kit, scene, m, r);

  // Relay Station 3 on the south roof, just west of the crossing.
  const relayGlow = new StandardMaterial("glowArcade", scene);
  relayGlow.emissiveColor = new Color3(0.35, 0.85, 1);
  relayGlow.disableLighting = true;
  const solid = (mesh: Mesh, material: StandardMaterial, cast = true) => kit.add(mesh, material, { cast, keep: true });
  const relayStation = buildRelayModel(scene, solid, { concrete: m.concrete, metal: m.metal, rust: m.rust, solar: m.solar, alien: kit.flat("alien", 0.12, 0.13, 0.16, 0.6), glow: relayGlow }, 326, 9.5, ARCADE.roof);

  kit.finish();
  buildPlants(scene, r);

  return {
    relayStation,
    relayGlow,
    spawn: new Vector3(328.6, ARCADE.roof + 0.2, 11.2),
    spawnYaw: Math.PI / 2,
    clock,
    floodLine,
    shutter: shops.shutter,
    bikeRack: props.bikeRack,
    toyBoat: props.toyBoat,
    tracks: station.tracks,
    mossShutters: shops.mossShutters,
    glassPiles: props.glassPiles,
    counters: shops.counters,
  };
}

// --- Street floor, canal and water ---------------------------------------------------

function buildGround(kit: Kit, scene: Scene, m: Mats): void {
  const { street, crossing, canal, shallows, landing, station, mudBank } = ARCADE;
  // The arcade street, west and east of the crossing (the east part leaves a hole for the station stairs).
  kit.box("arcadeFloorW", landing.x1, crossing.x0, -1, 0, street.z0, street.z1, m.paving, { cast: false });
  kit.box("arcadeFloorE1", crossing.x1, station.x0, -1, 0, street.z0, street.z1, m.paving, { cast: false });
  kit.box("arcadeFloorE2", station.x0, ARCADE.x1, -1, 0, street.z0, station.z0, m.paving, { cast: false });
  kit.box("arcadeFloorE3", station.x0, ARCADE.x1, -1, 0, station.z1, street.z1, m.paving, { cast: false });
  // The crossing: canal banks, the deep canal and the shallows where the street crosses it.
  for (const [z0, z1] of [[canal.z0, street.z0], [street.z1, canal.z1]] as const) {
    kit.box("canalBankW", crossing.x0, canal.x0, -4, 0, z0, z1, m.stone, { cast: false });
    kit.box("canalBankE", canal.x1, crossing.x1, -4, 0, z0, z1, m.stone, { cast: false });
    kit.box("canalBed", canal.x0, canal.x1, -4, canal.bed, z0, z1, m.dirt, { cast: false });
  }
  kit.box("canalBankWS", crossing.x0, canal.x0, -1, 0, street.z0, street.z1, m.paving, { cast: false });
  kit.box("canalBankES", canal.x1, crossing.x1, -1, 0, street.z0, street.z1, m.paving, { cast: false });
  kit.box("shallows", shallows.x0, shallows.x1, -1.5, shallows.bed, shallows.z0, shallows.z1, m.dirt, { cast: false });
  // Entrance landing with two steps down into the water.
  kit.box("arcadeLanding", landing.x0, landing.x1, -1, landing.y, street.z0, street.z1, m.stone, { cast: false });
  kit.box("arcadeLandingStep", landing.x1, landing.x1 + 0.9, -1, landing.y - 0.45, street.z0, street.z1, m.stone, { cast: false });
  // The mud bank before the station stairs.
  kit.box("mudBank", mudBank.x0, mudBank.x1, -0.5, mudBank.y, mudBank.z0, mudBank.z1, m.dirt, { cast: false });

  const water = MeshBuilder.CreateGround("arcadeWater", { width: ARCADE.x1 - ARCADE.landing.x0, height: ARCADE.z1 - ARCADE.z0 }, scene);
  water.position.set((ARCADE.landing.x0 + ARCADE.x1) / 2, ARCADE.water, (ARCADE.z0 + ARCADE.z1) / 2);
  water.material = m.water;
  water.isPickable = false;
  water.receiveShadows = true;
  water.freezeWorldMatrix();
}

// --- Shops ------------------------------------------------------------------------

interface ShopsResult {
  shutter: Mesh[];
  mossShutters: { mesh: Mesh; pulled: boolean }[];
  counters: Vector3[];
}

/** Where the fallen roof panels lean against the shop fronts (no awnings there). */
const RAMPS = [
  { from: new Vector3(298, 0, 15.3), to: new Vector3(311.5, ARCADE.roof, 15.3) },
  { from: new Vector3(374, 0, 22.7), to: new Vector3(360.5, ARCADE.roof, 22.7) },
];

function buildShops(kit: Kit, scene: Scene, m: Mats, r: () => number): ShopsResult {
  const result: ShopsResult = { shutter: [], mossShutters: [], counters: [] };
  const { roof, crossing, landing } = ARCADE;
  const facades = [m.facadeA, m.facadeB, m.facadeC];
  const sign = kit.card("sign");
  const moss = mossMaterial(scene);
  let index = 0;
  for (const [x0, x1] of [[landing.x1, crossing.x0], [crossing.x1, ARCADE.x1]] as const) {
    const count = Math.round((x1 - x0) / 7.5);
    const w = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      for (const side of [-1, 1] as const) {
        const a = x0 + i * w;
        const b = a + w;
        const front = side < 0 ? ARCADE.street.z0 : ARCADE.street.z1;
        const back = side < 0 ? ARCADE.shopsS.z0 : ARCADE.shopsN.z1;
        // z helpers: `d` metres from the front towards the back.
        const z = (d: number) => front + side * d;
        const span = (d0: number, d1: number): [number, number] => [Math.min(z(d0), z(d1)), Math.max(z(d0), z(d1))];
        const facade = facades[(index + (side < 0 ? 0 : 1)) % 3];
        index++;
        const kind = shopKind(index, r);
        // Upper floors and the back of the ground floor are solid.
        kit.box("shopUpper", a, b, 3.4, roof - 0.2, ...span(0, Math.abs(front - back)), facade);
        kit.box("shopRoof", a, b, roof - 0.2, roof, ...span(0, Math.abs(front - back)), m.roofSlab, { cast: false });
        kit.box("shopBack", a, b, 0, 3.4, ...span(3, Math.abs(front - back)), facade);
        kit.box("shopSideA", a, a + 0.3, 0, 3.4, ...span(0, 3), facade);
        kit.box("shopSideB", b - 0.3, b, 0, 3.4, ...span(0, 3), facade);
        kit.box("shopFloor", a + 0.3, b - 0.3, -1, 0.7, ...span(0, 3), m.paving, { cast: false });
        // Parapet strip and a sign board on the upper facade.
        kit.box("shopParapet", a, b, roof, roof + 0.25, ...span(Math.abs(front - back) - 0.4, Math.abs(front - back)), m.concrete, { collide: false });
        if (r() < 0.7) {
          const board = MeshBuilder.CreatePlane("shopSign", { width: w - 2.2, height: 0.9 }, scene);
          board.position.set((a + b) / 2, 4.35 + r() * 0.4, z(-0.03));
          board.rotation.y = side < 0 ? Math.PI : 0;
          kit.add(board, sign, { collide: false, cast: false });
        }
        const onRamp = RAMPS.some((p) => Math.abs(p.from.z - front) < 2.5 && Math.max(a, Math.min(p.from.x, p.to.x)) < Math.min(b, Math.max(p.from.x, p.to.x)));
        if (kind === "closed" || kind === "pulled") {
          // Rolled-down shutter, mossed over.
          if (kind === "pulled") {
            // The moss has peeled the lower half of the shutter out into the street.
            kit.box("shutterTop", a + 0.3, b - 0.3, 2.1, 3.4, ...span(0.05, 0.2), m.shutter);
            const peel = MeshBuilder.CreateBox("shutterPeel", { width: w - 0.6, height: 1.9, depth: 0.12 }, scene);
            peel.position.set((a + b) / 2, 1.25, z(-0.45));
            peel.rotation.x = side * 0.55;
            kit.add(peel, m.shutter, { keep: true, collide: false });
            const mat = mossMat(scene, "pulled", (a + b) / 2, 1.3, z(-0.62), w - 0.8, 1.6, side * 0.55, moss);
            result.mossShutters.push({ mesh: mat, pulled: true });
          } else {
            const sh = kit.box("shutter", a + 0.3, b - 0.3, 0.7, 3.4, ...span(0.05, 0.2), m.shutter, { keep: result.shutter.length === 0 });
            if (result.shutter.length === 0) result.shutter.push(sh);
            if (r() < 0.75) result.mossShutters.push({ mesh: mossMat(scene, "closed", (a + b) / 2, 1.2 + r() * 0.6, z(-0.08), 1.6 + r() * 2.5, 1 + r() * 1.2, 0, moss), pulled: false });
          }
        } else {
          // Open shop: half-raised shutter and a counter standing out of the water.
          kit.box("shutterHalf", a + 0.3, b - 0.3, 2.7, 3.4, ...span(0.05, 0.2), m.shutter);
          kit.box("counter", a + 0.5, b - 0.5, 0.7, 1.4, ...span(0.3, 1), m.wood);
          result.counters.push(new Vector3((a + b) / 2, 1.4, z(0.65)));
          // Shelves in the dark at the back.
          for (const y of [1.2, 2.1, 2.9]) kit.box("shelf", a + 0.5, b - 0.5, y, y + 0.06, ...span(2.4, 2.95), m.wood, { collide: false, cast: false });
        }
        // Awnings at the first floor (climbable from a counter), balconies higher up.
        if (!onRamp && kind !== "pulled" && r() < 0.65) {
          const ruined = r() < 0.3;
          kit.box("awning", a + 0.2, b - (ruined ? w * 0.45 : 0.2), 3.2, 3.4, ...span(-1.2, 0), ruined ? m.rust : m.wood, { tile: 1.5 });
          if (r() < 0.6) kit.box("balcony", a + 1, b - 1, 5.1, 5.3, ...span(-0.9, 0), m.concrete);
        }
      }
    }
  }
  // The fallen roof panels: slopes from the water up to the roof edge, each ending
  // on a flat panel that bridges to the roof.
  for (const [i, p] of RAMPS.entries()) {
    const dir = Math.sign(p.to.x - p.from.x);
    const zs = p.from.z < ARCADE_AXIS ? [ARCADE.street.z0 - 0.5, p.from.z + 1] : [p.from.z - 1, ARCADE.street.z1 + 0.5];
    kit.box(`roofPanelLanding${i}`, Math.min(p.to.x, p.to.x + dir * 2.5), Math.max(p.to.x, p.to.x + dir * 2.5), roof - 0.25, roof, zs[0], zs[1], m.steel, { tile: 2 });
    kit.slope(`fallenRoofPanel${i}`, p.from, p.to, 2, 0.3, m.steel, { tile: 2 });
    const pane = kit.slope(`fallenRoofGlass${i}`, p.from.add(new Vector3(0, 0.18, 0)), p.to.add(new Vector3(0, 0.18, 0)), 1.6, 0.05, m.glass, { collide: false, cast: false, keep: true });
    pane.isPickable = false;
  }
  return result;
}

type ShopKind = "closed" | "open" | "pulled";

function shopKind(index: number, r: () => number): ShopKind {
  if (index === 9) return "pulled";
  return r() < 0.55 ? "open" : "closed";
}

function mossMaterial(scene: Scene): StandardMaterial {
  return organic(scene, "shopfront-moss", "#5a7a2e", "moss");
}

/**
 * Shopfront Moss photo: thick, lumpy cushions spilling over the shutter, heaviest along the bottom,
 * with drips hanging down. One merged mesh per mat, tilted with a peeled shutter.
 */
function mossMat(scene: Scene, kind: string, x: number, y: number, z: number, w: number, h: number, tilt: number, material: StandardMaterial): Mesh {
  const r = rng(Math.round(x * 31 + z * 7 + y * 13));
  const lumps: Mesh[] = [];
  const n = Math.round(6 + w * h * 5);
  for (let i = 0; i < n; i++) {
    const u = r() - 0.5, v = Math.pow(r(), 1.6) - 0.5;
    const size = 0.3 + r() * 0.4;
    const l = MeshBuilder.CreateSphere(`shopfrontMoss:${kind}`, { diameter: 1, segments: 3 }, scene);
    l.scaling.set(size * (1 + r() * 0.6), size * (0.6 + r() * 0.4), 0.16 + r() * 0.2);
    l.position.set(u * w, -v * h, 0);
    lumps.push(l);
  }
  // Drips hanging from the lower edge.
  for (let i = 0; i < Math.round(w * 0.7); i++) {
    const l = MeshBuilder.CreateSphere(`shopfrontMoss:${kind}`, { diameter: 1, segments: 2 }, scene);
    l.scaling.set(0.12 + r() * 0.08, 0.25 + r() * 0.2, 0.1);
    l.position.set((r() - 0.5) * w * 0.9, -h / 2 - 0.05, 0);
    lumps.push(l);
  }
  const p = Mesh.MergeMeshes(lumps, true)!;
  p.name = `shopfrontMoss:${kind}`;
  p.position.set(x, y, z);
  p.rotation.x = tilt;
  p.material = material;
  p.receiveShadows = true;
  return p;
}

// --- Glass roof -------------------------------------------------------------------

function buildRoof(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const { street, roof, crossing } = ARCADE;
  const ridge = roof + 3;
  for (let x = 292; x < ARCADE.x1; x += 6) {
    // A few trusses have come down entirely.
    const fallen = x === 316 || x === 370;
    if (fallen) continue;
    // Tie beam across the street: walkable from roof to roof.
    kit.box("trussTie", x - 0.25, x + 0.25, roof - 0.35, roof, street.z0, street.z1, m.steel, { tile: 2 });
    for (const [z0, z1] of [[street.z0, ARCADE_AXIS], [street.z1, ARCADE_AXIS]] as const) {
      const rafter = kit.slope("trussRafter", new Vector3(x, roof, z0), new Vector3(x, ridge, z1), 0.25, 0.25, m.steel, { collide: false, tile: 2 });
      rafter.isPickable = false;
    }
    kit.box("trussPost", x - 0.12, x + 0.12, roof, ridge, ARCADE_AXIS - 0.12, ARCADE_AXIS + 0.12, m.steel, { collide: false });
  }
  // Ridge and purlins along the whole arcade (broken where trusses fell).
  for (const [x0, x1] of [[292, 313], [319, 367], [373, 395]] as const) {
    kit.box("roofRidge", x0, x1, ridge - 0.2, ridge, ARCADE_AXIS - 0.15, ARCADE_AXIS + 0.15, m.steel, { collide: false });
    for (const t of [0.5]) {
      for (const zEdge of [street.z0, street.z1]) {
        const zz = zEdge + (ARCADE_AXIS - zEdge) * t;
        kit.box("roofPurlin", x0, x1, roof + 3 * t - 0.1, roof + 3 * t + 0.08, zz - 0.1, zz + 0.1, m.steel, { collide: false });
      }
    }
  }
  // Eave girders over the crossing: the south one intact, the north one broken.
  // They overlap the roof edges so the robot can step straight on.
  kit.box("eaveGirderS", crossing.x0 - 1, crossing.x1 + 1, roof - 0.4, roof, street.z0 - 0.6, street.z0 + 0.9, m.steel, { tile: 2 });
  kit.box("eaveGirderN1", crossing.x0 - 1, 338.6, roof - 0.4, roof, street.z1 - 0.9, street.z1 + 0.6, m.steel, { tile: 2 });
  kit.box("eaveGirderN2", 341.4, crossing.x1 + 1, roof - 0.4, roof, street.z1 - 0.9, street.z1 + 0.6, m.steel, { tile: 2 });
  const hanging = MeshBuilder.CreateBox("eaveGirderBent", { width: 3, height: 0.4, depth: 1 }, scene);
  hanging.position.set(339.4, roof - 1.5, street.z1 - 0.6);
  hanging.rotation.z = -0.9;
  kit.add(hanging, m.steel, { collide: false, tile: 2 });

  // Glass panes: whole bays here and there, the rest long gone.
  for (let x = 292; x < ARCADE.x1 - 6; x += 6) {
    if (x === 310 || x === 316 || x === 364 || x === 370) continue;
    for (const [z0, z1] of [[street.z0, ARCADE_AXIS], [street.z1, ARCADE_AXIS]] as const) {
      if (r() < 0.62) continue;
      const pane = MeshBuilder.CreateBox("roofPane", { width: 6, height: 0.04, depth: Math.hypot(5, 3) }, scene);
      pane.rotation.x = (z0 < z1 ? -1 : 1) * Math.atan2(3, 5);
      pane.position.set(x + 3, roof + 1.5 + 0.05, (z0 + z1) / 2);
      kit.add(pane, m.glass, { collide: false, cast: false });
    }
  }
}

// --- The arcade clock ---------------------------------------------------------------

function buildClock(kit: Kit, scene: Scene, m: Mats): Mesh[] {
  const c = ARCADE.clock;
  const faceMat = new StandardMaterial("arcadeClockFace", scene);
  faceMat.diffuseTexture = paint(scene, "tex:arcadeClock", 256, drawClockFace);
  faceMat.specularColor = new Color3(0.4, 0.4, 0.4);
  // Arcade Clock photo: a double-faced station clock in a cast case gone green-brown, with moulded
  // bezels, a crown on top and a hanging loop.
  const cast = organic(scene, "arcade-clock-case", "#4f5544", "bronze");
  cast.specularColor = new Color3(0.2, 0.2, 0.17);
  const parts: Mesh[] = [];
  const housing = MeshBuilder.CreateCylinder("clockHousing", { diameter: 2.7, height: 0.62, tessellation: 28 }, scene);
  housing.rotation.z = Math.PI / 2;
  housing.position.copyFrom(c);
  kit.add(housing, cast, { keep: true, collide: false });
  parts.push(housing);
  const trim: Mesh[] = [];
  for (const side of [-1, 1]) {
    const face = MeshBuilder.CreateDisc("clockFace", { radius: 1.15, tessellation: 28 }, scene);
    face.position.set(c.x + side * 0.33, c.y, c.z);
    face.rotation.y = side * -Math.PI / 2;
    face.material = faceMat;
    face.receiveShadows = true;
    parts.push(face);
    for (const [d, t] of [[2.5, 0.14], [2.72, 0.08]] as const) {
      const bezel = MeshBuilder.CreateTorus("clockBezel", { diameter: d, thickness: t, tessellation: 28 }, scene);
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(c.x + side * 0.33, c.y, c.z);
      trim.push(bezel);
    }
  }
  // Crown: a stepped cap, scrolls either side and a finial with the hanging loop.
  const cap = MeshBuilder.CreateBox("clockCrown", { width: 0.75, height: 0.22, depth: 0.9 }, scene);
  cap.position.set(c.x, c.y + 1.42, c.z);
  const knob = MeshBuilder.CreateSphere("clockCrown", { diameter: 0.3, segments: 8 }, scene);
  knob.position.set(c.x, c.y + 1.62, c.z);
  const loop = MeshBuilder.CreateTorus("clockCrown", { diameter: 0.34, thickness: 0.06, tessellation: 12 }, scene);
  loop.rotation.y = Math.PI / 2;
  loop.rotation.z = Math.PI / 2;
  loop.position.set(c.x, c.y + 1.86, c.z);
  trim.push(cap, knob, loop);
  for (const dz of [-1, 1]) {
    const scroll = MeshBuilder.CreateTorus("clockCrown", { diameter: 0.3, thickness: 0.07, tessellation: 12 }, scene);
    scroll.rotation.z = Math.PI / 2;
    scroll.position.set(c.x, c.y + 1.3, c.z + dz * 0.55);
    trim.push(scroll);
  }
  const ornament = Mesh.MergeMeshes(trim, true)!;
  ornament.name = "clockOrnament";
  kit.add(ornament, cast, { keep: true, collide: false });
  parts.push(ornament);
  // Hung from the tie beam above on two rods.
  for (const dz of [-0.7, 0.7]) {
    const rod = MeshBuilder.CreateCylinder("clockRod", { diameter: 0.08, height: ARCADE.roof - 0.35 - (c.y + 1.2), tessellation: 5 }, scene);
    rod.position.set(c.x, (ARCADE.roof - 0.35 + c.y + 1.2) / 2, c.z + dz);
    kit.add(rod, m.steel, { keep: true, collide: false, cast: false });
    parts.push(rod);
  }
  return parts;
}

function drawClockFace(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#d9d2bd";
  c.fillRect(0, 0, s, s);
  for (let i = 0; i < 300; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "90,80,60" : "60,70,50"}, ${0.05 + r() * 0.12})`;
    c.fillRect(r() * s, r() * s, 2 + r() * 10, 2 + r() * 10);
  }
  const cx = s / 2;
  c.strokeStyle = "#2c2a26";
  c.lineWidth = s * 0.02;
  c.beginPath();
  c.arc(cx, cx, s * 0.46, 0, Math.PI * 2);
  c.stroke();
  // Hour marks (no numerals: the city's script is its own).
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = s * (i % 3 === 0 ? 0.33 : 0.37);
    c.lineWidth = s * (i % 3 === 0 ? 0.03 : 0.015);
    c.beginPath();
    c.moveTo(cx + Math.sin(a) * r0, cx - Math.cos(a) * r0);
    c.lineTo(cx + Math.sin(a) * s * 0.42, cx - Math.cos(a) * s * 0.42);
    c.stroke();
  }
  // Stopped at twenty past four.
  const hand = (a: number, len: number, wd: number) => {
    c.lineWidth = s * wd;
    c.beginPath();
    c.moveTo(cx, cx);
    c.lineTo(cx + Math.sin(a) * s * len, cx - Math.cos(a) * s * len);
    c.stroke();
  };
  hand(((4 + 20 / 60) / 12) * Math.PI * 2, 0.22, 0.035);
  hand((20 / 60) * Math.PI * 2, 0.34, 0.022);
  // Cracks across the glass.
  c.strokeStyle = "rgba(250,250,245,0.7)";
  c.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    let x = cx + (r() - 0.5) * s * 0.3;
    let y = cx + (r() - 0.5) * s * 0.3;
    c.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (r() - 0.5) * s * 0.2;
      y += (r() - 0.5) * s * 0.2;
      c.lineTo(x, y);
    }
    c.stroke();
  }
}

// --- The Flood Line pillar -------------------------------------------------------------

function buildFloodPillar(kit: Kit, scene: Scene, m: Mats): Mesh[] {
  const p = ARCADE.floodPillar;
  const pillar = kit.box("floodPillar", p.x0, p.x1, 0, ARCADE.roof, p.z0, p.z1, m.concrete, { keep: true });
  const mat = new StandardMaterial("floodLineMarks", scene);
  mat.diffuseTexture = paint(scene, "tex:floodLine", 512, drawFloodLine, true);
  mat.diffuseTexture.hasAlpha = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = Color3.Black();
  // The same record on both faces along the street, so it reads from either direction.
  const faces = [-1, 1].map((side) => {
    const marks = MeshBuilder.CreatePlane("floodLine", { width: p.z1 - p.z0 - 0.1, height: ARCADE.roof - 0.4 }, scene);
    marks.position.set(side < 0 ? p.x0 - 0.02 : p.x1 + 0.02, ARCADE.roof / 2 + 0.1, (p.z0 + p.z1) / 2);
    marks.rotation.y = -side * Math.PI / 2;
    marks.material = mat;
    marks.receiveShadows = true;
    return marks;
  });
  return [pillar, ...faces];
}

/**
 * Flood Line photo: a painted depth gauge running up the pillar (white band, black ticks, red every
 * metre) and beside it the marks scratched and painted as the water rose, one per day.
 */
function drawFloodLine(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  // The plane is tall and narrow (1.7 x 6.6 m); the texture is stretched to fit.
  const gx = s * 0.04, gw = s * 0.16;
  c.fillStyle = "rgba(214,206,186,0.92)";
  c.fillRect(gx, 0, gw, s);
  for (let i = 0; i <= 66; i++) {
    const y = s - (i / 66) * s;
    const major = i % 10 === 0, mid = i % 5 === 0;
    c.fillStyle = major ? "rgba(160,40,30,0.95)" : "rgba(30,28,26,0.85)";
    c.fillRect(gx, y - (major ? 3 : 1.5), gw * (major ? 1 : mid ? 0.7 : 0.4), major ? 6 : 3);
    if (major) {
      // A numeral in the city's script beside each metre.
      c.fillRect(gx + gw + 4, y - 10, 4, 14);
      c.fillRect(gx + gw + 4, y - 10, 12, 3);
      c.fillRect(gx + gw + 12, y - 4, 3, 8);
    }
  }
  // Grime over the gauge.
  for (let i = 0; i < 120; i++) {
    c.fillStyle = `rgba(70,64,48,${0.05 + r() * 0.15})`;
    c.fillRect(gx + r() * gw, r() * s, 2 + r() * 8, 2 + r() * 20);
  }
  const marks = 26;
  for (let i = 0; i < marks; i++) {
    const t = i / (marks - 1);
    // The water rose slowly at first, then faster.
    const y = s * (0.93 - Math.pow(t, 0.8) * 0.88);
    const w = s * (0.4 + r() * 0.3);
    const x0 = s * 0.3 + r() * s * 0.06;
    const ink = i % 4 === 3 ? "rgba(150,52,40,0.85)" : "rgba(38,36,34,0.8)";
    c.fillStyle = ink;
    c.fillRect(x0, y, w, s * 0.006 + r() * s * 0.003);
    // Little tallies and scribbles beside each line: dates and notes in the city's script.
    for (let k = 0; k < 3 + r() * 5; k++) c.fillRect(x0 + w + 4 + k * 6, y - 6 + r() * 4, 3, 6 + r() * 5);
  }
  // The highest mark, near the roof, circled.
  c.strokeStyle = "rgba(150,52,40,0.9)";
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(s * 0.55, s * 0.05 + 3, s * 0.3, s * 0.025, 0, 0, Math.PI * 2);
  c.stroke();
  // Water stains: the real line, much lower, where the water stands now, and green slime below it.
  c.fillStyle = "rgba(60,58,40,0.4)";
  c.fillRect(0, s * 0.9, s, s * 0.1);
  c.fillStyle = "rgba(70,90,40,0.35)";
  c.fillRect(0, s * 0.95, s, s * 0.05);
}

// --- Station entrance and the Predecessor's tracks ---------------------------------------

function buildStationEntrance(kit: Kit, scene: Scene, m: Mats, r: () => number): { tracks: Mesh[] } {
  const st = ARCADE.station;
  // Stairs down into black water; the robot can wade in until it is too deep.
  stairs(kit, scene, "stationStairs", st.x1, st.x0, st.z0, st.z1, -3.2, 0, m.stone);
  kit.box("stationStairsBed", st.x0, st.x1, -4.5, -3.2, st.z0, st.z1, m.dirt, { cast: false });
  // Low walls on both sides of the stairwell, and the entrance canopy.
  kit.box("stationWallS", st.x0, st.x1, -3.5, 1.1, st.z0 - 0.4, st.z0, m.stone);
  kit.box("stationWallN", st.x0, st.x1, -3.5, 1.1, st.z1, st.z1 + 0.4, m.stone);
  kit.box("stationCanopy", st.x1 - 1, ARCADE.x1, 4.2, 4.6, st.z0 - 1, st.z1 + 1, m.concreteDark);
  for (const z of [st.z0 - 0.7, st.z1 + 0.7]) kit.box("stationCanopyPost", st.x1 - 0.8, st.x1 - 0.4, 0, 4.2, z - 0.2, z + 0.2, m.steel);
  // The tunnel mouth: dark under the canopy, blocked by fallen slabs below the water.
  const dark = kit.flat("stationDark", 0.02, 0.025, 0.03, 0);
  kit.box("stationMouth", ARCADE.x1 - 0.2, ARCADE.x1, -3.5, 4.2, st.z0, st.z1, dark, { cast: false });
  for (let i = 0; i < 4; i++) {
    const slab = MeshBuilder.CreateBox("stationSlab", { width: 2.4, height: 0.4, depth: 4.5 }, scene);
    slab.position.set(st.x1 + 1 + r() * 1.5, -0.6 + i * 0.3, (st.z0 + st.z1) / 2 + (r() - 0.5) * 2);
    slab.rotation.set(r() * 0.3, r(), 0.5 + r() * 0.4);
    kit.add(slab, m.concreteDark, { collide: false, tile: 2 });
  }
  // A sign over the canopy: the metro symbol, faded.
  const signMat = new StandardMaterial("metroSign", scene);
  signMat.diffuseTexture = paint(scene, "tex:metroSign", 256, drawMetroSign);
  signMat.specularColor = Color3.Black();
  const board = MeshBuilder.CreatePlane("metroSign", { width: 3.2, height: 1.1 }, scene);
  board.position.set(st.x1 - 1.05, 5.25, (st.z0 + st.z1) / 2);
  board.rotation.y = Math.PI / 2;
  board.material = signMat;
  kit.box("metroSignBox", st.x1 - 1, st.x1 - 0.9, 4.6, 5.9, (st.z0 + st.z1) / 2 - 1.7, (st.z0 + st.z1) / 2 + 1.7, m.steel, { collide: false });

  // Track marks across the mud bank, down the first steps.
  const b = ARCADE.mudBank;
  const trackMat = new StandardMaterial("predecessorTracks", scene);
  trackMat.diffuseTexture = paint(scene, "tex:predecessorTracks", 256, drawTracks, true);
  trackMat.diffuseTexture.hasAlpha = true;
  trackMat.useAlphaFromDiffuseTexture = true;
  trackMat.specularColor = Color3.Black();
  trackMat.zOffset = -2;
  const tracks = MeshBuilder.CreateGround("predecessorTracks", { width: b.x1 - b.x0 - 0.4, height: 1.6 }, scene);
  tracks.position.set((b.x0 + b.x1) / 2 + 0.2, b.y + 0.012, (b.z0 + b.z1) / 2);
  tracks.material = trackMat;
  tracks.receiveShadows = true;
  return { tracks: [tracks] };
}

function drawMetroSign(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = "#2f4a5a";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#d8d3c4";
  c.beginPath();
  c.arc(s * 0.22, s * 0.5, s * 0.17, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#2f4a5a";
  c.fillRect(s * 0.15, s * 0.42, s * 0.14, s * 0.16);
  c.fillStyle = "#d8d3c4";
  for (let i = 0; i < 4; i++) c.fillRect(s * (0.46 + i * 0.12), s * 0.38, s * 0.08, s * 0.24);
  for (let i = 0; i < 500; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "20,30,30" : "200,190,170"}, ${0.08 + r() * 0.2})`;
    c.fillRect(r() * s, r() * s, 2 + r() * 8, 2 + r() * 5);
  }
}

/** Origin Tracks photo: two broad chevron tread bands pressed into the mud, heading east, with ridges of pushed-up mud. */
function drawTracks(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  for (const y0 of [s * 0.14, s * 0.6]) {
    const h = s * 0.26;
    c.fillStyle = "rgba(38,30,20,0.5)";
    c.fillRect(0, y0, s, h);
    c.fillStyle = "rgba(150,128,96,0.45)";
    c.fillRect(0, y0 - 4, s, 4);
    c.fillRect(0, y0 + h, s, 4);
    c.strokeStyle = "rgba(24,18,12,0.85)";
    c.lineWidth = 3.5;
    for (let x = 0; x < s + 12; x += 12) {
      const jx = x + r() * 1.5;
      c.beginPath();
      c.moveTo(jx - 6, y0 + 3);
      c.lineTo(jx + 2, y0 + h / 2);
      c.lineTo(jx - 6, y0 + h - 3);
      c.stroke();
    }
  }
  // Puddles left standing in the treads.
  for (let i = 0; i < 10; i++) {
    c.fillStyle = `rgba(120,130,120,${0.15 + r() * 0.2})`;
    c.beginPath();
    c.ellipse(r() * s, (r() < 0.5 ? 0.27 : 0.73) * s, 6 + r() * 14, 3 + r() * 6, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// --- Props: glass piles, bicycles, the toy boat --------------------------------------------

function buildProps(kit: Kit, scene: Scene, m: Mats, r: () => number): { glassPiles: Vector3[]; bikeRack: Mesh[]; toyBoat: Mesh[] } {
  // Fallen roof glass heaped in the water: reed beds root in the shards.
  const glassPiles = [new Vector3(303, 0, 20.5), new Vector3(322.5, 0, 16.8), new Vector3(356, 0, 20), new Vector3(381, 0, 17)];
  const shard = kit.flat("arcadeGlassShard", 0.5, 0.62, 0.6, 0.7);
  shard.alpha = 0.55;
  for (const p of glassPiles) {
    kit.box("glassHeap", p.x - 1.4, p.x + 1.4, -0.2, 0.62, p.z - 1, p.z + 1, m.rubble, { cast: false, tile: 1.5 });
    for (let i = 0; i < 7; i++) {
      const g = MeshBuilder.CreateBox("glassShard", { width: 0.8 + r() * 1.2, height: 0.03, depth: 0.6 + r() * 0.8 }, scene);
      g.position.set(p.x + (r() - 0.5) * 2.4, 0.6 + r() * 0.15, p.z + (r() - 0.5) * 1.6);
      g.rotation.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.8);
      kit.add(g, shard, { collide: false, cast: false });
    }
    p.y = 0.62;
  }

  // Rental bicycles on the entrance landing, rusted into their rack (Bicycle Rack photo): step-through
  // frames, spoked wheels with perished tyres, front baskets with plants growing in them.
  const L = ARCADE.landing;
  const rack = kit.box("bikeRackRail", L.x0 + 0.8, L.x1 - 0.8, L.y + 0.55, L.y + 0.65, 22.6, 22.7, m.steel, { keep: true, collide: false });
  const frameMat = organic(scene, "rental-bike-frame", "#6d4a33", "rusted");
  const tyreMat = kit.flat("rentalBikeTyre", 0.07, 0.065, 0.06);
  const basketPlant = organic(scene, "rental-bike-plant", "#4f6e30", "leaf");
  const bf = new Form(scene, "rentalBikes");
  for (let i = 0; i < 4; i++) {
    const x = L.x0 + 1.4 + i * 1.5, y = L.y;
    const hub = (z: number): [number, number, number] => [x, y + 0.33, z];
    for (const z of [21.55, 22.65]) {
      const tyre = bf.ring(hub(z), 0.66, 0.05, tyreMat);
      tyre.rotation.z = Math.PI / 2;
      const rim = bf.ring(hub(z), 0.58, 0.02, frameMat);
      rim.rotation.z = Math.PI / 2;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI;
        bf.branch([[x, y + 0.33 + Math.cos(a) * 0.29, z + Math.sin(a) * 0.29], [x, y + 0.33 - Math.cos(a) * 0.29, z - Math.sin(a) * 0.29]], 0.006, frameMat);
      }
    }
    // Step-through frame: down tube, seat tube, chain stays, fork and bars.
    const head: [number, number, number] = [x, y + 0.8, 21.78], bb: [number, number, number] = [x, y + 0.3, 22.15], seat: [number, number, number] = [x, y + 0.82, 22.32];
    bf.branch([head, [x, y + 0.42, 21.98], bb], 0.022, frameMat);
    bf.branch([bb, seat], 0.02, frameMat);
    bf.branch([bb, hub(22.65)], 0.014, frameMat);
    bf.branch([[x, y + 0.7, 22.3], hub(22.65)], 0.012, frameMat);
    bf.branch([[x, y + 0.92, 21.74], head, hub(21.55)], 0.018, frameMat);
    bf.branch([[x - 0.26, y + 0.98, 21.8], [x, y + 0.95, 21.72], [x + 0.26, y + 0.98, 21.8]], 0.014, frameMat);
    bf.ellipsoid([x, y + 0.86, 22.36], [0.12, 0.06, 0.24], tyreMat, 6);
    bf.box([x, y + 0.68, 22.62], [0.16, 0.02, 0.36], frameMat);
    // Wire basket on the front, gone green inside.
    for (const yy of [0.82, 0.98, 1.08]) bf.ring([x, y + yy, 21.5], 0.36, 0.012, frameMat).scaling.set(1, 1, 0.8);
    for (let k = 0; k < 4; k++) bf.ellipsoid([x + (k % 2 - 0.5) * 0.14, y + 1.1 + (k > 1 ? 0.06 : 0), 21.5 + (k > 1 ? 0.06 : -0.06)], [0.16, 0.08, 0.1], basketPlant, 5).rotation.z = (k - 1.5) * 0.4;
  }
  const bikeMesh = Mesh.MergeMeshes(bf.finish(), true, true, undefined, false, true)!;
  bikeMesh.name = "rentalBikes";
  const bikeMulti = bikeMesh.material;
  kit.add(bikeMesh, frameMat, { keep: true, collide: false });
  bikeMesh.material = bikeMulti;
  const bikeRack = [rack, bikeMesh];

  // A child's plastic boat, caught at the canal's edge south of the crossing (Toy Boat photo): blue
  // hull with a white gunwale and red stripe, a cream cabin with dark windows and a red funnel.
  const blue = kit.flat("toyBoatPlastic", 0.18, 0.38, 0.62, 0.3);
  const white = kit.flat("toyBoatWhite", 0.82, 0.8, 0.72, 0.2);
  const red = kit.flat("toyBoatRed", 0.7, 0.16, 0.12, 0.2);
  const pane = kit.flat("toyBoatWindow", 0.08, 0.1, 0.12, 0.4);
  const tf = new Form(scene, "toyBoat");
  tf.box([0, 0.05, 0], [0.6, 0.16, 0.32], blue);
  tf.ellipsoid([0.3, 0.05, 0], [0.34, 0.16, 0.32], blue, 8);
  tf.ellipsoid([-0.3, 0.05, 0], [0.12, 0.16, 0.32], blue, 8);
  tf.box([0.02, 0.11, 0], [0.78, 0.025, 0.335], red);
  tf.box([0.02, 0.14, 0], [0.76, 0.025, 0.32], white);
  tf.box([-0.04, 0.22, 0], [0.3, 0.14, 0.22], white);
  tf.box([-0.04, 0.3, 0], [0.34, 0.025, 0.26], red);
  for (const dz of [-0.112, 0.112]) for (const dx of [-0.12, 0.03]) tf.box([dx, 0.23, dz], [0.07, 0.05, 0.005], pane);
  const funnel = MeshBuilder.CreateCylinder("toyBoat", { diameter: 0.08, height: 0.14, tessellation: 8 }, scene);
  funnel.position.set(-0.08, 0.38, 0);
  tf.add(funnel, red);
  const boat = Mesh.MergeMeshes(tf.finish(), true, true, undefined, false, true)!;
  boat.name = "toyBoat";
  boat.position.set(335.1, ARCADE.water, 4.2);
  boat.rotation.y = 0.4;
  const boatMulti = boat.material;
  kit.add(boat, blue, { keep: true, collide: false });
  boat.material = boatMulti;
  const toyBoat = [boat];

  return { glassPiles, bikeRack, toyBoat };
}

// --- Backdrop: buildings around the arcade, the hill to the west, the far towers -----------

function buildBackdrop(kit: Kit, scene: Scene, m: Mats, r: () => number): void {
  const { crossing, canal } = ARCADE;
  // Taller blocks behind the shop rows, too high to climb.
  for (const [x0, x1] of [[ARCADE.landing.x0, crossing.x0], [crossing.x1, ARCADE.x1]] as const) {
    for (let x = x0; x < x1; ) {
      const w = Math.min(x1 - x, 9 + r() * 8);
      const h = 13 + r() * 6;
      kit.box("backBldgS", x, x + w, 0, h, ARCADE.z0, ARCADE.shopsS.z0, r() < 0.5 ? m.facadeC : m.facadeA);
      kit.box("backBldgN", x, x + w, 0, 13 + r() * 6, ARCADE.shopsN.z1, ARCADE.z1, r() < 0.5 ? m.facadeA : m.facadeB);
      x += w;
    }
  }
  // The east end, with the metro entrance under it.
  kit.box("endBldgS", ARCADE.x1, ARCADE.x1 + 12, 0, 16, ARCADE.z0, ARCADE.station.z0 - 1, m.facadeC);
  kit.box("endBldgN", ARCADE.x1, ARCADE.x1 + 12, 0, 16, ARCADE.station.z1 + 1, ARCADE.z1, m.facadeC);
  kit.box("endBldgTop", ARCADE.x1, ARCADE.x1 + 12, 4.2, 16, ARCADE.station.z0 - 1, ARCADE.station.z1 + 1, m.facadeC);
  // Rubble where the canal's side streets were closed off by collapses.
  for (const z of [canal.z0 - 2, canal.z1]) kit.box("canalCollapse", crossing.x0, crossing.x1, -4, 9, z, z + 2, m.rubble);
  for (let i = 0; i < 6; i++) {
    const z = i < 3 ? canal.z0 + r() * 2 : canal.z1 - r() * 2;
    const s = 1 + r() * 1.5;
    const block = MeshBuilder.CreateBox("canalRubble", { width: s * 1.6, height: s * 0.8, depth: s }, scene);
    block.position.set(crossing.x0 + 1 + r() * 10, -0.4 + r() * 0.8, z);
    block.rotation.set(r() * 0.5, r() * 3, r() * 0.5);
    kit.add(block, m.rubble, { collide: false, tile: 2 });
  }
  // The hill the temple stands on, west of the passage building.
  kit.box("arcadeHillS", 222, 250, 0, 10, -30, 8, m.dirt, { cast: false });
  kit.box("arcadeHillN", 222, 250, 0, 10, 15.5, 60, m.dirt, { cast: false });
  const crowns: Mesh[] = [];
  for (let z = -28; z < 58; z += 5 + r() * 4) {
    for (const x of [228 + r() * 6, 240 + r() * 7]) {
      const c = MeshBuilder.CreateSphere("hillCrown", { diameter: 7 + r() * 6, segments: 4 }, scene);
      c.scaling.y = 0.8;
      c.position.set(x, 14 + r() * 6, z);
      crowns.push(c);
    }
  }
  const forest = Mesh.MergeMeshes(crowns, true)!;
  forest.name = "hillCrowns";
  forest.material = m.leaves;
  forest.isPickable = false;
  forest.freezeWorldMatrix();

  // Far towers in the haze to the east: where the city goes next.
  const haze = new StandardMaterial("towerHaze", scene);
  haze.disableLighting = true;
  haze.diffuseColor = Color3.Black();
  haze.specularColor = Color3.Black();
  const towers: Mesh[] = [];
  for (const [x, z, w, h] of [[560, -40, 26, 120], [610, 30, 34, 160], [650, -110, 30, 95], [700, 90, 40, 140], [540, 120, 22, 80]]) {
    const t = MeshBuilder.CreateBox("farTower", { width: w, height: h, depth: w * 0.8 }, scene);
    t.position.set(x, h / 2 - 5, z);
    towers.push(t);
  }
  const far = Mesh.MergeMeshes(towers, true)!;
  far.name = "towerHaze";
  far.material = haze;
  far.applyFog = false;
  far.isPickable = false;
  far.freezeWorldMatrix();
  scene.onBeforeRenderObservable.add(() => {
    if (!far.isEnabled()) return;
    const f = scene.fogColor;
    haze.emissiveColor.set(f.r * 0.86, f.g * 0.88, f.b * 0.9);
  });
}

// --- Undergrowth --------------------------------------------------------------------

function buildPlants(scene: Scene, r: () => number): void {
  const fern = card(scene, "fern");
  const grass = card(scene, "grassTuft");
  const bigLeaf = card(scene, "bigLeaf");
  const ferns: { x: number; y: number; z: number; s: number }[] = [];
  const tufts: typeof ferns = [];
  const leaves: typeof ferns = [];
  const { roof, street } = ARCADE;
  // Roof gardens: grass and ferns over the shop roofs.
  for (let i = 0; i < 160; i++) {
    const south = r() < 0.5;
    const x = 290 + r() * 106;
    if (x > 333 && x < 347) continue;
    const z = south ? ARCADE.shopsS.z0 + r() * 8 : ARCADE.shopsN.z0 + r() * 8;
    if (Math.abs(x - 326) < 3 && south && z < 12.5) continue;
    tufts.push({ x, y: roof, z, s: 0.7 + r() * 0.7 });
    if (r() < 0.3) ferns.push({ x, y: roof, z: z + (r() - 0.5), s: 0.9 + r() * 0.6 });
  }
  // Along the shop fronts, at the waterline.
  for (let i = 0; i < 70; i++) {
    const x = 290 + r() * 106;
    if (x > 333 && x < 347) continue;
    const z = r() < 0.5 ? street.z0 + 0.35 : street.z1 - 0.35;
    ferns.push({ x, y: 0.35, z, s: 0.8 + r() * 0.5 });
  }
  // Big leaves on the counters and the landing.
  for (let i = 0; i < 8; i++) leaves.push({ x: 283 + r() * 5, y: ARCADE.landing.y, z: r() < 0.5 ? street.z0 + 0.4 + r() * 1.2 : street.z1 - 0.4 - r() * 0.8, s: 0.7 + r() * 0.4 });
  scatterCards(scene, "ferns", fern, 1.4, 1.1, 2, ferns, r);
  scatterCards(scene, "arcadeTufts", grass, 0.8, 0.55, 2, tufts, r);
  scatterCards(scene, "giantLeaves", bigLeaf, 1.6, 1.4, 3, leaves, r);

  // Vines hanging from the roof edges into the arcade.
  const vine = card(scene, "vine");
  const cards: Mesh[] = [];
  for (let x = 290; x < ARCADE.x1 - 2; x += 1.2 + r() * 2.6) {
    if (x > 333 && x < 347) continue;
    for (const [z, facing] of [[street.z0 + 0.03, Math.PI], [street.z1 - 0.03, 0]] as const) {
      if (r() < 0.45) continue;
      const len = 1.5 + r() * 4.5;
      const p = MeshBuilder.CreatePlane("arcadeVine", { width: 1.2 + r() * 1.4, height: len }, scene);
      p.position.set(x, roof - len / 2, z);
      p.rotation.y = facing;
      p.bakeCurrentTransformIntoVertices();
      cards.push(p);
    }
  }
  const vines = Mesh.MergeMeshes(cards, true)!;
  vines.name = "arcadeVines";
  vines.material = vine;
  vines.isPickable = false;
  vines.receiveShadows = true;
  vines.freezeWorldMatrix();
}
