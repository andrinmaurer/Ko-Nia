import { Mesh, MeshBuilder, Scene, ShadowGenerator, Vector3 } from "../babylon";
import { Kit, scatterCards, stairs } from "./kit";
import { card, rng } from "./textures";
import { BREACH, GROUND } from "./templeHill";

/**
 * The way from Temple Hill down to the Flooded Arcade. It is drawn with both
 * blocks, and they swap inside the stairwell of the arcade's old west building
 * (see `passageRegionAt`).
 *
 *   breach in the temple's east wall (x 232, z 9.5..14)
 *   → sunken path east through the forest, y 10 (x 232..250)
 *   → into the building's third floor: corridor east (leg A)
 *   → north (leg B, where the blocks swap)
 *   → stairwell east, y 10 → 1 (leg C)
 *   → out onto the arcade's entrance landing (x 282)
 */
export const PASSAGE = {
  path: { x0: 232, x1: 250, z0: 10, z1: 13.5 },
  building: { x0: 250, x1: 282, z0: 4, z1: 30, top: 19 },
  legA: { x0: 250, x1: 256, z0: 10, z1: 13.5 },
  legB: { x0: 256, x1: 259.5, z0: 10, z1: 24 },
  legC: { x0: 259.5, x1: 282, z0: 20.5, z1: 24 },
  /** The stairwell's bottom, level with the arcade's entrance landing. */
  bottom: 1,
};

/**
 * Which block to draw for a robot at `p` while it is around the passage, or
 * undefined to keep the current one. Two thresholds in leg B give hysteresis;
 * from there neither the temple doorway nor the arcade exit is in view.
 */
export function passageRegionAt(p: Vector3, current: "temple" | "arcade"): "temple" | "arcade" | undefined {
  if (p.x < PASSAGE.legA.x0) return "temple";
  if (p.x > PASSAGE.legC.x0 + 2.5) return "arcade";
  const b = PASSAGE.legB;
  const inLegB = p.x > b.x0 - 0.5 && p.x < b.x1 + 0.5;
  if (current === "temple" && inLegB && p.z > 17.5) return "arcade";
  if (current === "arcade" && inLegB && p.z < 16.5) return "temple";
  return undefined;
}

export function buildArcadePassage(scene: Scene, shadows: ShadowGenerator): void {
  const kit = new Kit(scene, shadows);
  const r = rng(3307);
  const m = {
    dirt: kit.tex("dirt", 5),
    rock: kit.tex("rubble", 4),
    rubble: kit.tex("rubble", 3),
    plaster: kit.tex("plaster", 3),
    stone: kit.tex("stone", 2),
    paving: kit.tex("sidewalk", 3),
    facade: kit.tex("facadeLight", 8, 6.4),
    facadeDark: kit.tex("facadeDark", 8, 6.4),
    concrete: kit.tex("concrete", 4),
    concreteDark: kit.tex("concreteDark", 4),
    roof: kit.tex("roof", 5),
    rust: kit.tex("rust", 2),
  };
  const { path, building: bd, legA, legB, legC } = PASSAGE;
  const top = GROUND + 3.4;

  // --- Breach and sunken path ------------------------------------------------
  // Rubble from the fallen wall spills out onto the path.
  for (let i = 0; i < 10; i++) {
    const s = 0.3 + r() * 0.6;
    const rock = MeshBuilder.CreateBox("breachRubble", { width: s * 1.5, height: s * 0.6, depth: s }, scene);
    rock.position.set(229 + r() * 7, GROUND + s * 0.25, BREACH.z0 + 0.4 + r() * (BREACH.z1 - BREACH.z0 - 0.8));
    rock.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }
  kit.box("breachPath", path.x0, path.x1, 0, GROUND, path.z0 - 2, path.z1 + 2, m.dirt, { cast: false });
  // Earth banks on both sides, too steep to climb.
  kit.box("breachBankS", path.x0, path.x1, GROUND, GROUND + 4.5, path.z0 - 2, path.z0, m.rock);
  kit.box("breachBankN", path.x0, path.x1, GROUND, GROUND + 4, path.z1, path.z1 + 2, m.rock);

  // --- The arcade's west building ---------------------------------------------
  // Solid masses around the three corridors, from the arcade's street level up.
  // Bare concrete inside; a facade skin on the outside faces.
  const mass = (name: string, x0: number, x1: number, z0: number, z1: number, y1 = bd.top) => kit.box(name, x0, x1, 0, y1, z0, z1, m.concreteDark);
  const skin = 0.12;
  kit.box("westBldgFacadeW1", bd.x0 - skin, bd.x0, 0, bd.top, bd.z0, legA.z0, m.facade, { collide: false });
  kit.box("westBldgFacadeW2", bd.x0 - skin, bd.x0, 0, bd.top, legA.z1, bd.z1, m.facade, { collide: false });
  kit.box("westBldgFacadeW3", bd.x0 - skin, bd.x0, top, bd.top, legA.z0, legA.z1, m.facade, { collide: false });
  kit.box("westBldgFacadeS", bd.x0, bd.x1, 0, bd.top, bd.z0 - skin, bd.z0, m.facadeDark, { collide: false });
  kit.box("westBldgFacadeN", bd.x0, bd.x1, 0, bd.top, bd.z1, bd.z1 + skin, m.facadeDark, { collide: false });
  kit.box("westBldgFacadeE1", bd.x1, bd.x1 + skin, 0, bd.top, bd.z0, legC.z0, m.facade, { collide: false });
  kit.box("westBldgFacadeE2", bd.x1, bd.x1 + skin, 0, bd.top - 2, legC.z1, bd.z1, m.facade, { collide: false });
  // Over the stairwell's exit: a wall down to door height.
  kit.box("westBldgFacadeE3", bd.x1 - 0.4, bd.x1 + skin, PASSAGE.bottom + 4, bd.top, legC.z0, legC.z1, m.facade);
  mass("westBldgSW", bd.x0, legB.x1, bd.z0, legA.z0);
  mass("westBldgNW", bd.x0, legB.x0, legA.z1, bd.z1);
  mass("westBldgSE", legB.x1, bd.x1, bd.z0, legC.z0);
  mass("westBldgNE", legB.x0, bd.x1, legC.z1, bd.z1, bd.top - 2);
  kit.box("westBldgFloor", legA.x0, legB.x1, 0, GROUND, legA.z0, legB.z1, m.concrete, { cast: false });
  // Ceilings: over legs A and B, and a high one over the stairwell.
  kit.box("westBldgCeilA", legA.x0, legB.x1, top, bd.top, legA.z0, legB.z1, m.plaster);
  kit.box("westBldgCeilC", legC.x0, bd.x1, top + 1.5, bd.top - 2, legC.z0, legC.z1, m.plaster);
  // Stairwell: a landing at the top, the stairs, a landing at the bottom.
  kit.box("westBldgLandingTop", legC.x0, 262, 0, GROUND, legC.z0, legC.z1, m.concrete, { cast: false });
  stairs(kit, scene, "westBldgStairs", 280, 262, legC.z0, legC.z1, PASSAGE.bottom, GROUND, m.paving);
  kit.box("westBldgUnderStairs", 262, 280, 0, PASSAGE.bottom, legC.z0, legC.z1, m.concrete, { cast: false });
  kit.box("westBldgLandingLow", 280, bd.x1, 0, PASSAGE.bottom, legC.z0, legC.z1, m.concrete, { cast: false });
  // The doorway frame facing the temple, and a cornice line on the outside.
  kit.box("westBldgLintel", bd.x0 - 0.3, bd.x0, top - 0.6, top + 0.6, legA.z0 - 0.4, legA.z1 + 0.4, m.stone, { collide: false });
  kit.box("westBldgCornice", bd.x0 - 0.4, bd.x1 + 0.4, bd.top - 0.4, bd.top, bd.z0 - 0.4, bd.z1 + 0.4, m.concrete, { collide: false });
  // A rooftop water tank, rusted through: a silhouette for the skyline.
  const tank = MeshBuilder.CreateCylinder("westBldgTank", { diameter: 3.2, height: 3, tessellation: 12 }, scene);
  tank.position.set(272, bd.top + 1.5, 9);
  kit.add(tank, m.rust, { collide: false });

  // Debris in the dark corridors.
  for (let i = 0; i < 8; i++) {
    const inA = i < 4;
    const x = inA ? legA.x0 + 1 + r() * 4.5 : legB.x0 + 0.4 + r() * 2.7;
    const z = inA ? (r() < 0.5 ? legA.z0 + 0.4 : legA.z1 - 0.4) : legB.z0 + 4 + r() * 9;
    const s = 0.25 + r() * 0.4;
    const rock = MeshBuilder.CreateBox("passageDebris", { width: s * 1.6, height: s * 0.6, depth: s }, scene);
    rock.position.set(x, GROUND + s * 0.25, z);
    rock.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }
  kit.finish();

  // Ferns and grass along the sunken path; vines down the building's west face.
  const fern = card(scene, "fern");
  const grass = card(scene, "grassTuft");
  const ferns: { x: number; y: number; z: number; s: number }[] = [];
  const tufts: typeof ferns = [];
  for (let i = 0; i < 26; i++) {
    const z = r() < 0.5 ? path.z0 + 0.3 : path.z1 - 0.3;
    ferns.push({ x: path.x0 + 1 + r() * 16, y: GROUND, z: z + (r() - 0.5) * 0.4, s: 0.8 + r() * 0.6 });
  }
  for (let i = 0; i < 50; i++) tufts.push({ x: path.x0 + r() * 18, y: GROUND, z: path.z0 + r() * (path.z1 - path.z0), s: 0.5 + r() * 0.5 });
  for (let i = 0; i < 24; i++) tufts.push({ x: path.x0 + r() * 18, y: GROUND + (r() < 0.5 ? 4.5 : 4), z: r() < 0.5 ? path.z0 - 1 : path.z1 + 1, s: 1 + r() * 0.5 });
  scatterCards(scene, "ferns", fern, 1.4, 1.1, 2, ferns, r);
  scatterCards(scene, "passageTufts", grass, 0.8, 0.55, 2, tufts, r);
  const vine = card(scene, "vine");
  const cards: Mesh[] = [];
  for (let z = bd.z0 + 1; z < bd.z1 - 1; z += 1.5 + r() * 2.5) {
    if (z > legA.z0 - 1 && z < legA.z1 + 1) continue;
    const len = 4 + r() * 8;
    const p = MeshBuilder.CreatePlane("passageVine", { width: 1.4 + r() * 1.4, height: len }, scene);
    p.position.set(bd.x0 - 0.04, bd.top - len / 2, z);
    p.rotation.y = Math.PI / 2;
    p.bakeCurrentTransformIntoVertices();
    cards.push(p);
  }
  const vines = Mesh.MergeMeshes(cards, true)!;
  vines.name = "passageVines";
  vines.material = vine;
  vines.isPickable = false;
  vines.freezeWorldMatrix();
}
