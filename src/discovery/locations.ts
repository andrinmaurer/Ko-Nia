import type { Vector3 } from "../babylon";

interface Zone {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  yMin?: number;
  yMax?: number;
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
  // Tower Foot: the floors of the tower by height, then the plaza around it
  { id: "loc-canopy-terrace", x0: 583, x1: 621, z0: -37, z1: -7, yMin: 32.6 },
  { id: "loc-board-room", x0: 583.5, x1: 606.5, z0: -15.6, z1: -7.5, yMin: 29 },
  { id: "loc-split-floors", x0: 583, x1: 621, z0: -37, z1: -7, yMin: 7.4 },
  { id: "loc-tower-lobby", x0: 583.5, x1: 620.5, z0: -36.5, z1: -7.5, yMin: 0 },
  { id: "loc-tower-plaza", x0: 527, x1: 665, z0: -43, z1: 47, yMin: 0 },
  // Sunken Station (underground, so checked before the arcade above it)
  { id: "loc-ticket-hall", x0: 404, x1: 452.5, z0: -8, z1: 16, yMax: -2 },
  { id: "loc-stopped-train", x0: 472.5, x1: 538, z0: 7.2, z1: 10.6, yMax: -8 },
  { id: "loc-maintenance-tunnel", x0: 476, x1: 554, z0: -11, z1: -3.6, yMax: -8 },
  { id: "loc-platform", x0: 452.5, x1: 561, z0: -3.6, z1: 12.5, yMax: -8 },
  // Flooded Arcade
  { id: "loc-arcade-roof", x0: 289, x1: 398, z0: -6, z1: 44, yMin: 5.5 },
  { id: "loc-arcade-entrance", x0: 250, x1: 297, z0: 4, z1: 30 },
  { id: "loc-clock-crossing", x0: 332, x1: 348, z0: -6, z1: 44 },
];

/** The block each location belongs to: a scan anywhere in a block also records the block itself. */
const BLOCK_OF: Record<string, string> = {
  "loc-noodle-shop": "loc-shrine-street",
  "loc-overpass": "loc-shrine-street",
  "loc-shrine": "loc-shrine-street",
  "loc-canopy-terrace": "loc-tower-foot",
  "loc-board-room": "loc-tower-foot",
  "loc-split-floors": "loc-tower-foot",
  "loc-tower-lobby": "loc-tower-foot",
  "loc-tower-plaza": "loc-tower-foot",
  "loc-ticket-hall": "loc-sunken-station",
  "loc-stopped-train": "loc-sunken-station",
  "loc-maintenance-tunnel": "loc-sunken-station",
  "loc-platform": "loc-sunken-station",
  "loc-arcade-roof": "loc-flooded-arcade",
  "loc-arcade-entrance": "loc-flooded-arcade",
  "loc-clock-crossing": "loc-flooded-arcade",
};

export function blockLocationOf(locationId: string): string | undefined {
  return BLOCK_OF[locationId];
}

export function locationAt(p: Vector3): string {
  for (const z of ZONES) {
    if (p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1 && (z.yMin === undefined || p.y >= z.yMin) && (z.yMax === undefined || p.y <= z.yMax)) return z.id;
  }
  if (p.x > 571.5 && p.y < 0) return "loc-tower-foot";
  if (p.x > 386 && p.y < -1) return "loc-sunken-station";
  if (p.x > 282) return "loc-flooded-arcade";
  return p.x > 112 ? "loc-temple-courtyard" : "loc-shrine-street";
}
