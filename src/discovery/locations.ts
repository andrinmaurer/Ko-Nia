import type { Vector3 } from "@babylonjs/core";

interface Zone {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  yMin?: number;
}

/** Checked in order; the whole block falls back to Shrine Street. */
const ZONES: Zone[] = [
  { id: "loc-noodle-shop", x0: 6, x1: 22, z0: 5, z1: 20 },
  { id: "loc-overpass", x0: -22, x1: -3, z0: -5, z1: 5, yMin: 1.5 },
  { id: "loc-shrine", x0: 42, x1: 60, z0: -6, z1: 6 },
];

export function locationAt(p: Vector3): string {
  for (const z of ZONES) {
    if (p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1 && (z.yMin === undefined || p.y >= z.yMin)) return z.id;
  }
  return "loc-shrine-street";
}
