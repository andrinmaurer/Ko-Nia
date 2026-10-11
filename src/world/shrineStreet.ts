import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

/**
 * Greybox of "Shrine Street", the MVP block described in
 * docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md.
 *
 * Axes: +x runs east along the street towards the shrine, +z is north.
 * The street spans z -5..5. North buildings sit at z 5..25, south ones at z -5..-20,
 * with the back alley at z -20..-24.
 */

export interface ShrineStreet {
  spawn: Vector3;
  /** Yaw (radians) the player faces on spawn. */
  spawnYaw: number;
  relayStation: Mesh;
}

type Materials = ReturnType<typeof createMaterials>;

const STREET_LENGTH = 120;

export function buildShrineStreet(scene: Scene, shadows: ShadowGenerator): ShrineStreet {
  const mat = createMaterials(scene);

  const solid = (mesh: Mesh, material: StandardMaterial, castShadow = true): Mesh => {
    mesh.material = material;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    if (castShadow) shadows.addShadowCaster(mesh);
    return mesh;
  };

  /** Box with its base at `y` (default ground level). */
  const block = (
    name: string,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    height: number,
    material: StandardMaterial,
    y = 0,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width: x1 - x0, height, depth: z1 - z0 }, scene);
    mesh.position.set((x0 + x1) / 2, y + height / 2, (z0 + z1) / 2);
    return solid(mesh, material);
  };

  // Ground: asphalt street with sidewalks and a dirt/moss base everywhere else.
  const ground = MeshBuilder.CreateGround("ground", { width: STREET_LENGTH + 10, height: 60 }, scene);
  solid(ground, mat.dirt, false);
  const street = MeshBuilder.CreateGround("street", { width: STREET_LENGTH, height: 7 }, scene);
  street.position.y = 0.01;
  solid(street, mat.asphalt, false);

  buildBoundary(block, mat);
  buildNorthRow(block, mat);
  buildNoodleShop(block, mat);
  buildSouthRow(block, mat);
  buildOverpass(scene, block, solid, mat);
  buildShrine(scene, block, solid, mat);
  buildVegetation(scene, shadows, mat);
  buildPuddle(scene, mat);
  const relayStation = buildRelayStation(scene, solid, mat);

  return { spawn: new Vector3(-12, 0.2, -1), spawnYaw: Math.PI / 2, relayStation };
}

type BlockFn = (
  name: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  height: number,
  material: StandardMaterial,
  y?: number,
) => Mesh;
type SolidFn = (mesh: Mesh, material: StandardMaterial, castShadow?: boolean) => Mesh;

function buildBoundary(block: BlockFn, mat: Materials): void {
  // Collapsed towers close the block on every side, so no invisible walls are needed.
  block("boundaryNorth", -62, 62, 25, 27, 22, mat.concreteDark);
  block("boundarySouth", -62, 62, -28, -26, 18, mat.concreteDark);
  block("boundaryWest", -64, -60, -28, 27, 24, mat.concreteDark);
  block("boundaryEast", 60, 64, -28, 27, 20, mat.concreteDark);
  // Rubble at the west end of the street.
  block("rubbleWest1", -60, -55, -5, 5, 2.5, mat.rubble);
  block("rubbleWest2", -60, -57, -3, 3, 4.5, mat.rubble);
}

function buildNorthRow(block: BlockFn, mat: Materials): void {
  block("northA", -60, -35, 5, 25, 12, mat.concrete);
  block("northB", -35, -10, 5, 25, 15, mat.concreteDark);
  // Low building whose roof the overpass lands on; from here you can drop onto the noodle shop roof.
  block("northC", -10, 6, 5, 25, 6, mat.concrete);
  block("northShopBack", 6, 22, 20, 25, 10, mat.concreteDark);
  block("northD", 22, 40, 5, 25, 9, mat.concrete);
  block("northE", 40, 60, 5, 25, 8, mat.concreteDark);
}

function buildNoodleShop(block: BlockFn, mat: Materials): void {
  const t = 0.3;
  const h = 4;
  // Front wall facing the street, with a doorway at x 12..15.
  block("shopFrontL", 6, 12, 5, 5 + t, h, mat.plaster);
  block("shopFrontR", 15, 22, 5, 5 + t, h, mat.plaster);
  block("shopLintel", 12, 15, 5, 5 + t, h - 2.6, mat.plaster, 2.6);
  // Side walls (front room z 5..15, back room z 15..20).
  block("shopWallW", 6, 6 + t, 5, 20, h, mat.plaster);
  block("shopWallE", 22 - t, 22, 5, 20, h, mat.plaster);
  // Partition between front and back room, doorway at x 9..11.
  block("shopPartitionL", 6, 9, 15, 15 + t, h, mat.plaster);
  block("shopPartitionR", 11, 22, 15, 15 + t, h, mat.plaster);
  // Roof with a collapsed hole above the back room (x 12..16, z 16..19).
  const ry = h;
  const rt = 0.3;
  block("shopRoofFront", 6, 22, 5, 16, rt, mat.concrete, ry);
  block("shopRoofW", 6, 12, 16, 20, rt, mat.concrete, ry);
  block("shopRoofE", 16, 22, 16, 20, rt, mat.concrete, ry);
  block("shopRoofBack", 12, 16, 19, 20, rt, mat.concrete, ry);
  // Interior props.
  block("shopCounter", 9, 18, 11, 12, 1.1, mat.wood);
  block("shopVending", 19.5, 21.5, 6.5, 8.5, 0.9, mat.rust); // toppled vending machine
  block("shopMenuBoard", 9, 14, 14.6, 14.95, 1.2, mat.wood, 2);
  block("shopRubble", 12, 14.5, 16, 17.5, 0.8, mat.rubble); // fallen ceiling
}

function buildSouthRow(block: BlockFn, mat: Materials): void {
  // The outer buildings run all the way to the boundary to close off the alley ends.
  block("southA", -60, -35, -26, -5, 8, mat.concreteDark);
  block("southB", -35, -12, -20, -5, 7, mat.concrete);
  block("southC", -12, 5, -20, -5, 11, mat.concreteDark);
  // Gap at x 5..8 is the passage into the back alley.
  block("southD", 8, 22, -20, -5, 6, mat.concrete);
  block("southE", 22, 40, -20, -5, 13, mat.concreteDark);
  block("southF", 40, 60, -26, -5, 8, mat.concrete);
  // Alley clutter: AC units and drains along the backs of the buildings.
  for (const x of [-28, -19, -8, 12, 18, 31]) block(`alleyAC${x}`, x, x + 1.2, -20.8, -20, 0.9, mat.rust, 1.6);
  for (const x of [-22, 0, 27]) block(`alleyDrain${x}`, x, x + 1.5, -23.5, -22, 0.15, mat.metal);
}

function buildOverpass(scene: Scene, block: BlockFn, solid: SolidFn, mat: Materials): void {
  const deckY = 6;
  // Intact deck from the northC roof across the street.
  block("overpassDeck", -6, -3, -3.5, 5, 0.4, mat.concrete, deckY - 0.4);
  block("overpassRailW", -6, -5.8, -3.5, 5, 1, mat.metal, deckY);
  block("overpassRailE", -3.2, -3, -3.5, 5, 1, mat.metal, deckY);
  block("overpassPillar", -5, -4, -4.5, -3.5, deckY - 0.4, mat.concreteDark);

  // Collapsed southern half: a slab of rubble sloping west along the sidewalk down to the street.
  const length = 16;
  const ramp = MeshBuilder.CreateBox("overpassRamp", { width: length, height: 0.5, depth: 3 }, scene);
  const angle = Math.atan2(deckY, length - 1);
  ramp.rotation.z = angle;
  ramp.position.set(-6 - (length / 2) * Math.cos(angle) + 0.4, deckY / 2 - 0.2, -3.5);
  solid(ramp, mat.rubble);
  // Landing connecting the top of the ramp to the deck.
  block("overpassLanding", -6.5, -3, -5, -2, 0.4, mat.concrete, deckY - 0.4);
}

function buildShrine(scene: Scene, block: BlockFn, solid: SolidFn, mat: Materials): void {
  // Leaning torii gate across the street.
  const torii = (mesh: Mesh) => solid(mesh, mat.torii);
  const tiltZ = 0.06;
  for (const z of [-2.6, 2.6]) {
    const pillar = torii(MeshBuilder.CreateCylinder(`toriiPillar${z}`, { diameter: 0.5, height: 5 }, scene));
    pillar.position.set(44, 2.5, z);
    pillar.rotation.x = tiltZ;
  }
  const kasagi = torii(MeshBuilder.CreateBox("toriiKasagi", { width: 0.6, height: 0.4, depth: 7.5 }, scene));
  kasagi.position.set(44, 5.1, 0.3);
  kasagi.rotation.x = tiltZ;
  const nuki = torii(MeshBuilder.CreateBox("toriiNuki", { width: 0.35, height: 0.3, depth: 6.2 }, scene));
  nuki.position.set(44, 4.1, 0.25);
  nuki.rotation.x = tiltZ;

  // Guardian statues.
  for (const z of [-3.5, 3.5]) {
    block(`statueBase${z}`, 47, 48, z - 0.5, z + 0.5, 0.8, mat.stone);
    const statue = MeshBuilder.CreateSphere(`statue${z}`, { diameter: 1, segments: 8 }, scene);
    statue.scaling.y = 1.4;
    statue.position.set(47.5, 1.5, z);
    solid(statue, mat.stone);
  }

  // Shrine building with a pitched roof.
  block("shrinePlatform", 50, 58, -4, 4, 0.6, mat.stone);
  block("shrineHall", 51.5, 56.5, -2.5, 2.5, 3, mat.wood, 0.6);
  for (const side of [-1, 1]) {
    const slab = MeshBuilder.CreateBox(`shrineRoof${side}`, { width: 7, height: 0.25, depth: 3.6 }, scene);
    slab.rotation.x = side * 0.55;
    slab.position.set(54, 4.6, side * 1.45);
    solid(slab, mat.roof);
  }
  block("offeringBox", 50.3, 51.1, -0.6, 0.6, 0.7, mat.wood, 0.6);
}

function buildVegetation(scene: Scene, shadows: ShadowGenerator, mat: Materials): void {
  const decor = (mesh: Mesh, material: StandardMaterial, castShadow = true) => {
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (castShadow) shadows.addShadowCaster(mesh);
    return mesh;
  };

  // Big tree that has burst up through the sidewalk in front of northD.
  const trunk = MeshBuilder.CreateCylinder("bigTreeTrunk", { diameterTop: 0.9, diameterBottom: 1.8, height: 14 }, scene);
  trunk.position.set(28, 7, 6.5);
  trunk.checkCollisions = true;
  decor(trunk, mat.bark);
  const canopy = MeshBuilder.CreateSphere("bigTreeCanopy", { diameter: 11, segments: 8 }, scene);
  canopy.position.set(28, 14, 8);
  canopy.scaling.y = 0.7;
  decor(canopy, mat.leaves);

  // Shrine trees.
  for (const [x, z] of [[58, -4], [58, 4], [49, -4.5]]) {
    const t = MeshBuilder.CreateCylinder(`shrineTreeTrunk${x}${z}`, { diameter: 0.6, height: 6 }, scene);
    t.position.set(x, 3, z);
    t.checkCollisions = true;
    decor(t, mat.bark);
    const c = MeshBuilder.CreateSphere(`shrineTreeCanopy${x}${z}`, { diameter: 5, segments: 6 }, scene);
    c.position.set(x, 7, z);
    decor(c, mat.leaves);
  }

  // Moss creeping out of the alley.
  for (let x = -32; x < 38; x += 6) {
    const moss = MeshBuilder.CreateGround(`alleyMoss${x}`, { width: 4, height: 3.5 }, scene);
    moss.position.set(x, 0.02, -22);
    decor(moss, mat.moss, false);
  }
}

function buildPuddle(scene: Scene, mat: Materials): void {
  // Flooded pothole; the Sun Lotus grows in it (see life/plants.ts).
  const water = MeshBuilder.CreateDisc("lotusPuddle", { radius: 2.2, tessellation: 24 }, scene);
  water.rotation.x = Math.PI / 2;
  water.position.set(25, 0.03, -1.5);
  water.material = mat.water;
  water.isPickable = false;
}

function buildRelayStation(scene: Scene, solid: SolidFn, mat: Materials): Mesh {
  const pillar = MeshBuilder.CreateCylinder("relayStation", { diameterTop: 0.35, diameterBottom: 1, height: 6, tessellation: 6 }, scene);
  pillar.position.set(-12, 3, 2);
  solid(pillar, mat.alien);
  const ring = MeshBuilder.CreateTorus("relayRing", { diameter: 1.6, thickness: 0.08, tessellation: 32 }, scene);
  ring.position.set(-12, 3.2, 2);
  ring.material = mat.glow;
  ring.isPickable = false;
  scene.onBeforeRenderObservable.add(() => {
    ring.rotation.y += 0.01;
    ring.rotation.x = Math.sin(performance.now() / 1500) * 0.3;
  });
  const tip = MeshBuilder.CreateSphere("relayTip", { diameter: 0.4 }, scene);
  tip.position.set(-12, 6.2, 2);
  tip.material = mat.glow;
  tip.isPickable = false;
  return pillar;
}

function createMaterials(scene: Scene) {
  const make = (name: string, r: number, g: number, b: number, spec = 0.05) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = new Color3(r, g, b);
    m.specularColor = new Color3(spec, spec, spec);
    return m;
  };
  const glow = new StandardMaterial("glow", scene);
  glow.emissiveColor = new Color3(0.35, 0.85, 1);
  glow.disableLighting = true;
  const water = make("water", 0.18, 0.28, 0.3, 0.6);
  water.alpha = 0.85;
  return {
    asphalt: make("asphalt", 0.22, 0.23, 0.23),
    dirt: make("dirt", 0.3, 0.33, 0.24),
    concrete: make("concrete", 0.62, 0.61, 0.58),
    concreteDark: make("concreteDark", 0.46, 0.46, 0.45),
    plaster: make("plaster", 0.7, 0.66, 0.58),
    rubble: make("rubble", 0.5, 0.48, 0.45),
    stone: make("stone", 0.55, 0.55, 0.52),
    wood: make("wood", 0.42, 0.28, 0.18),
    roof: make("roof", 0.25, 0.27, 0.3),
    torii: make("torii", 0.68, 0.25, 0.16),
    rust: make("rust", 0.48, 0.28, 0.17),
    metal: make("metal", 0.35, 0.37, 0.4, 0.3),
    bark: make("bark", 0.3, 0.22, 0.15),
    leaves: make("leaves", 0.2, 0.45, 0.16),
    moss: make("moss", 0.28, 0.46, 0.18),
    alien: make("alien", 0.12, 0.13, 0.16, 0.6),
    water,
    glow,
  };
}
