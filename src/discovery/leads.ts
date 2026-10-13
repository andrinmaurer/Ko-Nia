import type { RegionId } from "../world/regions";

/**
 * Field leads: one vague line per organism or major find, shown in the Logbook
 * while it is still unscanned. They say where to look and what to notice, never
 * what the thing is, so the player still makes the discovery.
 */
export interface Lead {
  id: string;
  region: RegionId;
  text: string;
}

export const REGION_LABELS: Record<RegionId, string> = {
  street: "Shrine Street",
  temple: "Temple Hill",
  arcade: "Flooded Arcade",
  station: "Sunken Station",
  tower: "Tower Foot",
};

export const LEADS: Lead[] = [
  // Shrine Street
  { id: "hookbill", region: "street", text: "Large black birds hop along the street, picking things up." },
  { id: "shutter-fern", region: "street", text: "Ferns in the gutters snap shut as you pass." },
  { id: "rebar-ivy", region: "street", text: "Red leaves cover the façades. Something is climbing the metal." },
  { id: "sun-lotus", region: "street", text: "A single bloom stands in a flooded pothole on the street." },
  { id: "drainback", region: "street", text: "Something in the alley drains hides from fast movement." },
  { id: "choir-moss", region: "street", text: "A soft whistle near the shrine statues when the wind picks up." },
  { id: "lantern-wisteria", region: "street", text: "Pale curtains of flowers hang under the overpass." },
  { id: "lantern-moth", region: "street", text: "Something rests in the shadows under the overpass." },
  { id: "vault-mantis", region: "street", text: "Something guards the noodle shop's back room. It warns before it strikes." },
  { id: "origin-predecessor", region: "street", text: "Metal glints at the very top of the overpass." },
  // Temple Hill
  { id: "temple-cedar", region: "temple", text: "A giant tree has broken through the temple hall's roof." },
  { id: "tithe-ant", region: "temple", text: "Tidy columns cross the courtyard gravel." },
  { id: "gilded-carp", region: "temple", text: "Something large and gold moves deep in the temple pond." },
  { id: "moss-tanuki", region: "temple", text: "A mossy shape sleeps on the temple gate." },
  { id: "scroll-cap", region: "temple", text: "Pale growth on the old wood inside the main hall." },
  { id: "censer-puffball", region: "temple", text: "Swollen shapes crowd the dark half of the hall. Approach carefully." },
  { id: "origin-mark", region: "temple", text: "The pagoda is the highest point of the hill. Someone has been up there." },
  // Flooded Arcade
  { id: "glasswort-reed", region: "arcade", text: "Reeds grow thick where the roof glass fell." },
  { id: "gutter-lily", region: "arcade", text: "Pale flowers drift where the water is still." },
  { id: "wader-heron", region: "arcade", text: "A tall grey shape stalks the shallows." },
  { id: "shopfront-moss", region: "arcade", text: "Moss mats cover the rolled-down shutters." },
  { id: "mudskipper-shoal", region: "arcade", text: "Small fish gather around the old shop counters." },
  { id: "snapping-eel", region: "arcade", text: "Something with a ragged fin patrols the canal. Don't wade in." },
  { id: "art-flood-line", region: "arcade", text: "Someone wrote on the arcade's main pillar, again and again." },
  { id: "origin-tracks", region: "arcade", text: "Tracks in the mud near the station stairs." },
  // Sunken Station
  { id: "root-curtain", region: "station", text: "Pale threads hang from the ceiling. Some reach all the way down." },
  { id: "shaft-fern", region: "station", text: "Green grows where the daylight falls through. Only there." },
  { id: "cave-swift", region: "station", text: "Small shapes nest over the dark end of the track." },
  { id: "ticket-beetle", region: "station", text: "Something rustles inside the ticket machines." },
  { id: "pale-crayfish", region: "station", text: "Something moves in the drip pools where no light reaches." },
  { id: "tunnel-hound", region: "station", text: "A clicking in the tunnel behind the platform. Don't run down there." },
  { id: "art-departure-board", region: "station", text: "The board over the ticket gates still shows one line." },
  { id: "origin-charger", region: "station", text: "At the far end of the platform, something was wired into the wall." },
  // Tower Foot
  { id: "window-birch", region: "tower", text: "Pale trunks stand on the open floors, where desks used to be." },
  { id: "duct-vine", region: "tower", text: "Leaves are coming out of the air ducts." },
  { id: "lobby-fig", region: "tower", text: "Grey roots have the lobby's columns in a net." },
  { id: "glass-swallow", region: "tower", text: "Mud cups under the window ledges on the tower's front." },
  { id: "plaza-deer", region: "tower", text: "Something grazes in the plaza's long grass, and bolts at a run." },
  { id: "ledge-kite", region: "tower", text: "A thin whistle high on the split side. Keep away from the edges up there." },
  { id: "art-city-model", region: "tower", text: "Near the top floor, a room with a long table and something laid out on it." },
  { id: "origin-terrace", region: "tower", text: "Up on the roof, at the edge, something sits very still." },
];

/**
 * Up to `max` leads for unscanned entries: the current block first, then other
 * blocks the player has already found something in.
 */
export function activeLeads(region: RegionId, discovered: (id: string) => boolean, max = 3): Lead[] {
  const open = LEADS.filter((l) => !discovered(l.id));
  const visited = new Set<RegionId>([region]);
  for (const l of LEADS) if (discovered(l.id)) visited.add(l.region);
  const here = open.filter((l) => l.region === region);
  const elsewhere = open.filter((l) => l.region !== region && visited.has(l.region));
  return [...here, ...elsewhere].slice(0, max);
}
