import type { Vector3 } from "../babylon";

interface Zone {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  yMin?: number;
}

/** Checked in order; each block falls back to its main location. */
const ZONES: Zone[] = [
  // Shrine Street
  { id: "loc-noodle-shop", x0: 6, x1: 22, z0: 5, z1: 20 },
  { id: "loc-overpass", x0: -22, x1: -3, z0: -5, z1: 5, yMin: 1.5 },
  { id: "loc-shrine", x0: 42, x1: 60, z0: -6, z1: 6 },
  // Between the blocks
  { id: "loc-stair-lane", x0: 60, x1: 112, z0: -8, z1: 12.5 },
  // Temple Hill
  { id: "loc-temple-gate", x0: 112, x1: 124, z0: -2, z1: 16 },
  { id: "loc-main-hall", x0: 177, x1: 201, z0: -10, z1: 24 },
  { id: "loc-pagoda", x0: 157, x1: 171, z0: 25, z1: 39 },
  { id: "loc-koi-pond", x0: 126, x1: 158, z0: -30, z1: -6 },
  // Flooded Arcade
  { id: "loc-arcade-roof", x0: 289, x1: 398, z0: -6, z1: 44, yMin: 5.5 },
  { id: "loc-arcade-entrance", x0: 250, x1: 297, z0: 4, z1: 30 },
  { id: "loc-clock-crossing", x0: 332, x1: 348, z0: -6, z1: 44 },
];

export function locationAt(p: Vector3): string {
  for (const z of ZONES) {
    if (p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1 && (z.yMin === undefined || p.y >= z.yMin)) return z.id;
  }
  if (p.x > 282) return "loc-flooded-arcade";
  return p.x > 112 ? "loc-temple-courtyard" : "loc-shrine-street";
}
