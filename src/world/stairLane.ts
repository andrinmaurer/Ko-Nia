import { Mesh, MeshBuilder, Scene, ShadowGenerator, Vector3 } from "../babylon";
import { Kit, scatterCards, stairs, stoneLantern } from "./kit";
import { card, rng } from "./textures";

/**
 * The stair lane from Shrine Street up to Temple Hill. It belongs to neither
 * block and is always drawn; the blocks swap while the robot is in its dark,
 * covered middle (see `laneRegionAt`).
 *
 *   Shrine Street gap (x 60, z -4.5..-1)
 *   → open stairs east, y 0 → 4 (x 61..76)
 *   → covered passage through a ruined building: east (leg A), north (leg B), east (leg C)
 *   → open stairs east, y 4 → 10 (x 97..112)
 *   → Temple Hill gate (x 114)
 *
 * From the middle of leg B neither end of the passage is in view, so swapping
 * blocks there is never visible.
 */
export const LANE = {
  z0: -4.5,
  z1: -1,
  /** Leg B, the north-running middle of the covered passage. */
  legB: { x0: 84, x1: 87.5, z0: -1, z1: 5 },
  /** Leg C and the upper stairs. */
  upper: { z0: 5, z1: 8.5 },
};

/**
 * Which block should be drawn for a robot at `p`, or undefined to keep the current
 * one. The two thresholds in leg B give the swap some hysteresis.
 */
export function laneRegionAt(p: Vector3, current: "street" | "temple"): "street" | "temple" | undefined {
  if (p.x < 60) return "street";
  if (p.x > 112) return "temple";
  const inLegB = p.x > LANE.legB.x0 - 0.5 && p.x < LANE.legB.x1 + 0.5;
  if (current === "street" && ((inLegB && p.z > 2.5) || p.x > 88)) return "temple";
  if (current === "temple" && ((inLegB && p.z < 1.5) || p.x < 83.5)) return "street";
  return undefined;
}

export function buildStairLane(scene: Scene, shadows: ShadowGenerator): void {
  const kit = new Kit(scene, shadows);
  const r = rng(7741);
  const m = {
    stone: kit.tex("stone", 2),
    paving: kit.tex("sidewalk", 3),
    retaining: kit.tex("concreteDark", 4),
    wall: kit.tex("facadeDark", 8, 6.4),
    plaster: kit.tex("plaster", 3),
    rubble: kit.tex("rubble", 3),
    roof: kit.tex("roof", 5),
    dirt: kit.tex("dirt", 5),
    wood: kit.tex("wood", 3),
    // Fire boxes stand empty and dark (stone lantern photo).
    lantern: kit.flat("stoneLanternLight", 0.08, 0.07, 0.06),
  };

  const { z0, z1 } = LANE;

  // --- Lower stairs: y 0 → 4 between retaining walls ------------------------------
  stairs(kit, scene, "laneStairsLow", 61, 76, z0, z1, 0, 4, m.paving);
  kit.box("laneWallLowS", 64, 76, 0, 14, -8, z0, m.retaining);
  kit.box("laneWallLowN", 64, 76, 0, 13, z1, 3, m.retaining);

  // --- Covered passage through a ruined two-storey building (x 76..96) -----------
  kit.box("laneHill", 76, 96, 0, 4, -8, 12, m.paving, { cast: false });
  const top = 12;
  kit.box("laneHouseS", 76, 96, 4, top, -8, z0, m.wall);
  kit.box("laneHouseW", 76, 84, 4, top - 1, z1, 12, m.wall);
  kit.box("laneHouseE", 87.5, 96, 4, top - 2, z0, LANE.upper.z0, m.wall);
  kit.box("laneHouseN", 84, 96, 4, top, LANE.upper.z1, 12, m.wall);
  // Ceilings over the passage: leg A + corner, leg B + corner, leg C.
  kit.box("laneCeilA", 76, 87.5, 7.4, top - 1, z0, z1, m.plaster);
  kit.box("laneCeilB", 84, 87.5, 7.4, top - 1, z1, LANE.upper.z1, m.plaster);
  kit.box("laneCeilC", 87.5, 96, 7.4, top - 2, LANE.upper.z0, LANE.upper.z1, m.plaster);
  // A roof slab that slid off the lower east wing.
  const slab = kit.slope("laneRoofFallen", new Vector3(91, top - 2.5, 2), new Vector3(96, top + 0.2, 6), 6, 0.3, m.roof, { collide: false });
  slab.isPickable = false;
  // Rubble and a doorway frame in the dark.
  for (let i = 0; i < 9; i++) {
    const x = 77 + r() * 18;
    const z = x < 84 ? (r() < 0.5 ? z0 + 0.4 : z1 - 0.4) : x < 87.5 ? -1 + r() * 9 : LANE.upper.z0 + 0.4 + r() * 2.7;
    const s = 0.25 + r() * 0.4;
    const rock = MeshBuilder.CreateBox("laneDebris", { width: s * 1.6, height: s * 0.6, depth: s }, scene);
    rock.position.set(x, 4 + s * 0.25, z);
    rock.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
    kit.add(rock, m.rubble, { collide: false, cast: false, tile: 1 });
  }

  // --- Upper stairs: y 4 → 10 towards the temple gate ------------------------------
  const u = LANE.upper;
  kit.box("laneHillUp", 96, 112, 0, 4, 1, 12.5, m.dirt, { cast: false });
  stairs(kit, scene, "laneStairsUp", 97, 112, u.z0, u.z1, 4, 10, m.paving);
  kit.box("laneWallUpS", 96, 112, 0, 14, 1, u.z0, m.retaining);
  kit.box("laneWallUpN", 96, 112, 0, 13.5, u.z1, 12.5, m.retaining);
  // Stone lanterns on the wall tops, one fallen across the steps.
  for (const x of [100, 106]) for (const z of [u.z0 - 0.6, u.z1 + 0.6]) stoneLantern(kit, scene, m.stone, m.lantern, x, z < u.z0 ? 14 : 13.5, z);
  const fallen = MeshBuilder.CreateCylinder("laneFallenLantern", { diameter: 0.5, height: 1.6, tessellation: 6 }, scene);
  fallen.rotation.set(0, 0.3, Math.PI / 2 - 0.25);
  fallen.position.set(103, 6.7, u.z0 + 0.5);
  kit.add(fallen, m.stone, { collide: false });

  kit.finish();
  buildLaneGreenery(scene, r);
}

function buildLaneGreenery(scene: Scene, r: () => number): void {
  const fern = card(scene, "fern");
  const grass = card(scene, "grassTuft");
  const vine = card(scene, "vine");
  const ferns: { x: number; y: number; z: number; s: number }[] = [];
  const tufts: { x: number; y: number; z: number; s: number }[] = [];
  const along = (x0: number, x1: number, y0: number, y1: number, z: number, list: typeof ferns, n: number, s: number) => {
    for (let i = 0; i < n; i++) {
      const t = r();
      list.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, z: z + (r() - 0.5) * 0.5, s: s * (0.7 + r() * 0.6) });
    }
  };
  along(62, 76, 0, 4, LANE.z0 + 0.35, ferns, 16, 0.9);
  along(62, 76, 0, 4, LANE.z1 - 0.35, ferns, 16, 0.9);
  along(62, 76, 0, 4, LANE.z0 + 0.6, tufts, 30, 0.7);
  along(62, 76, 0, 4, LANE.z1 - 0.6, tufts, 30, 0.7);
  along(97, 112, 4, 10, LANE.upper.z0 + 0.35, ferns, 18, 1);
  along(97, 112, 4, 10, LANE.upper.z1 - 0.35, ferns, 18, 1);
  along(97, 112, 4, 10, (LANE.upper.z0 + LANE.upper.z1) / 2, tufts, 40, 0.6);
  // Wall tops are overgrown too.
  along(64, 76, 13, 13, 1, tufts, 30, 1.1);
  along(64, 76, 14, 14, -6.2, tufts, 30, 1.1);
  along(96, 112, 13.5, 13.5, 10.5, ferns, 14, 1.3);
  along(96, 112, 14, 14, 3, ferns, 14, 1.3);
  scatterCards(scene, "ferns", fern, 1.4, 1.1, 2, ferns, r);
  scatterCards(scene, "laneTufts", grass, 0.8, 0.55, 2, tufts, r);
  // Vines hanging into the stairwells.
  {
    const cards: Mesh[] = [];
    const hang = (x: number, top: number, z: number, facing: number) => {
      const len = 2 + r() * 5;
      const p = MeshBuilder.CreatePlane("laneVine", { width: 1.4 + r() * 1.4, height: len }, scene);
      p.position.set(x, top - len / 2, z);
      p.rotation.y = facing;
      p.bakeCurrentTransformIntoVertices();
      cards.push(p);
    };
    for (let x = 65; x < 76; x += 1.5 + r() * 2.5) {
      if (r() < 0.6) hang(x, 14, LANE.z0 + 0.04, 0);
      if (r() < 0.6) hang(x, 13, LANE.z1 - 0.04, Math.PI);
    }
    for (let x = 97; x < 112; x += 1.5 + r() * 2.5) {
      if (r() < 0.6) hang(x, 14, LANE.upper.z0 + 0.04, 0);
      if (r() < 0.6) hang(x, 13.5, LANE.upper.z1 - 0.04, Math.PI);
    }
    const merged = Mesh.MergeMeshes(cards, true)!;
    merged.name = "laneVines";
    merged.material = vine;
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.freezeWorldMatrix();
  }
}
