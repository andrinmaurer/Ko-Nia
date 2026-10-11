/**
 * Every Logbook entry in the MVP block. Content comes from
 * docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md.
 *
 * Organisms take three steps: first scan (page created), Biological scan,
 * and one behavior observation. Everything else is complete after one scan.
 */

export type Category = "flora" | "fauna" | "locations" | "artifacts" | "origin";

export const CATEGORY_LABELS: Record<Category, string> = {
  flora: "Biology · Flora",
  fauna: "Biology · Fauna",
  locations: "Locations",
  artifacts: "Human Artifacts",
  origin: "Origin",
};

export interface EntryDef {
  id: string;
  category: Category;
  /** Final name, revealed when the entry is complete. */
  name: string;
  /** Organisms only: scientific name, revealed by the Biological scan. */
  latin?: string;
  /** Organisms only: the behavior to witness, phrased for the observation checklist. */
  observation?: string;
  /** Shown from the first scan. */
  appearance: string;
  /** Organisms only: revealed by the Biological scan. */
  ancestry?: string;
  /** Organisms only: revealed by the behavior observation. */
  behavior?: string;
  /** Organisms only: hints shown on the page for the steps still missing. */
  hints?: { bio: string; observe: string };
  /** The colony's comment, shown when the entry is complete. */
  colonyNote: string;
  danger?: "none" | "high";
}

export const ENTRIES: EntryDef[] = [
  // Flora
  {
    id: "lantern-wisteria",
    category: "flora",
    name: "Lantern Wisteria",
    latin: "Wisteria lucerna",
    observation: "Night glow",
    appearance: "Climbing woody plant hanging in curtains from the overpass. Pale violet flowers, seed pods like paper lanterns.",
    ancestry: "Descendant of wisteria. The pods contain a light-producing tissue not found in the ancestor.",
    behavior: "At night the pods glow blue-green and attract Lantern Moths, which pollinate it.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "The pods look different after dark." },
    colonyNote: "A plant that turns on its own lights. Better at night than most of the colony.",
    danger: "none",
  },
  {
    id: "rebar-ivy",
    category: "flora",
    name: "Rebar Ivy",
    latin: "Hedera ferrivora",
    observation: "Splitting a wall",
    appearance: "Dense ivy with rust-red leaves. Thick stems follow exposed metal.",
    ancestry: "Descendant of ivy. Leaves store large amounts of iron taken from the metal it grows along.",
    behavior: "Its stems follow rebar into concrete and slowly split walls apart from the inside.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Find a wall it has broken open." },
    colonyNote: "Eats buildings. Slowly. We admire the patience.",
    danger: "none",
  },
  {
    id: "shutter-fern",
    category: "flora",
    name: "Shutter Fern",
    latin: "Claudopteris timida",
    observation: "Open fronds",
    appearance: "Knee-high fern clusters in gutters and cracks. The fronds are usually closed.",
    ancestry: "Descendant of a fern. Fast-moving cells at the base of each frond let it snap shut.",
    behavior: "Closes when something approaches quickly. Approached slowly, it stays open and shows a bright pattern inside.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "It closes when you rush. Try approaching slowly." },
    colonyNote: "Shy. Relatable.",
    danger: "none",
  },
  {
    id: "sun-lotus",
    category: "flora",
    name: "Sun Lotus",
    latin: "Nelumbo heliotropa",
    observation: "Turning with the sun",
    appearance: "Broad floating pads and a single tall bloom in a flooded pothole.",
    ancestry: "Descendant of the lotus. Its stem can twist slowly.",
    behavior: "The pads and bloom turn to follow the sun during the day and fold up at night.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Something about it changes over the day. Scan it again later." },
    colonyNote: "It moves. Very slowly. You may have to wait. We are good at waiting.",
    danger: "none",
  },
  {
    id: "choir-moss",
    category: "flora",
    name: "Choir Moss",
    latin: "Bryum chorale",
    observation: "Singing in the wind",
    appearance: "Moss carpets on the shrine statues, with tiny hollow upright stalks.",
    ancestry: "Descendant of a moss. The stalks are hollow tubes of different lengths.",
    behavior: "When the wind gusts, the stalks whistle a soft chord.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Listen for the wind." },
    colonyNote: "The only choir left in the city. It sings when nobody asks.",
    danger: "none",
  },
  // Fauna
  {
    id: "hookbill",
    category: "fauna",
    name: "Hookbill",
    latin: "Corvus uncirostris",
    observation: "Carrying a find home",
    appearance: "Large black bird with a copper sheen and a long hooked beak. Nests on the torii gate.",
    ancestry: "Descendant of a crow. Four grasping toes and a much larger body.",
    behavior: "Collects shiny human objects from the street and carries them back to its nest.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Watch what it brings back to the nest." },
    colonyNote: "A collector of human leftovers. Like you, but with feathers.",
    danger: "none",
  },
  {
    id: "lantern-moth",
    category: "fauna",
    name: "Lantern Moth",
    latin: "Lampadia nocturna",
    observation: "Night swarm",
    appearance: "Hand-sized moth with translucent wings. Rests hidden under the overpass during the day.",
    ancestry: "Descendant of a moth. Its markings contain the same light-producing tissue as the Lantern Wisteria.",
    behavior: "Swarms around the glowing Lantern Wisteria at night to feed, pollinating it.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "It seems to wait for something. Come back at night." },
    colonyNote: "The plant glows, the moth glows. Nobody remembers who started it.",
    danger: "none",
  },
  {
    id: "drainback",
    category: "fauna",
    name: "Drainback",
    latin: "Rattus loricatus",
    observation: "Foraging",
    appearance: "Dog-sized animal with overlapping armored plates on its back. Lives in the alley drains.",
    ancestry: "Descendant of a rat. The armor plates grew from thickened skin.",
    behavior: "Hides at any fast movement. If everything stays still, it comes out to forage.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Stay still near the drain and wait." },
    colonyNote: "It thinks you are dangerous. Cute.",
    danger: "none",
  },
  {
    id: "vault-mantis",
    category: "fauna",
    name: "Vault Mantis",
    latin: "Mantis custodiens",
    observation: "Guarding the egg case",
    appearance: "Dog-sized grey-green mantis, nearly invisible against the mossy tiles of the noodle shop's back room.",
    ancestry: "Descendant of a praying mantis. Grown far beyond the size of any insect from before.",
    behavior: "Guards an egg case. Warns intruders with a dry wing rattle, then strikes.",
    hints: { bio: "Closer analysis needed (Biological scan). Careful.", observe: "Observe it undisturbed. From above, maybe." },
    colonyNote: "Not a fan of visitors. Please do not get disassembled.",
    danger: "high",
  },
  // Locations
  {
    id: "loc-shrine-street",
    category: "locations",
    name: "Shrine Street",
    appearance: "A narrow shopping street on the edge of the old town. Bleached shop signs, roots splitting the asphalt.",
    colonyNote: "Your first street. Try not to get attached.",
  },
  {
    id: "loc-noodle-shop",
    category: "locations",
    name: "Noodle Shop",
    appearance: "A small ground-floor restaurant. Counter, stools, a toppled machine. The back room's ceiling has collapsed.",
    colonyNote: "Humans ate here. Standing up, mostly.",
  },
  {
    id: "loc-overpass",
    category: "locations",
    name: "Broken Overpass",
    appearance: "A concrete pedestrian bridge. Half of it has fallen into a ramp of rubble.",
    colonyNote: "Built to cross a street. Now mainly holds flowers.",
  },
  {
    id: "loc-shrine",
    category: "locations",
    name: "Neighborhood Shrine",
    appearance: "A small shrine behind a leaning red gate, guarded by two moss-covered statues.",
    colonyNote: "A quiet place. Even the birds keep their voices down here.",
  },
  // Human artifacts
  {
    id: "art-vending-machine",
    category: "artifacts",
    name: "Vending Machine",
    appearance: "A toppled metal cabinet with a glass front. Rows of empty slots inside.",
    colonyNote: "A box that exchanged objects for other objects. Humans were very trusting of boxes.",
  },
  {
    id: "art-menu-board",
    category: "artifacts",
    name: "Menu Board",
    appearance: "A wooden board with faded symbols in columns. Some kind of list.",
    colonyNote: "A list of things to eat. The prices have not aged well.",
  },
  {
    id: "art-torii",
    category: "artifacts",
    name: "Red Gate",
    appearance: "Two pillars and two crossbeams, painted red. It leads nowhere practical.",
    colonyNote: "A door without walls. Humans walked through it anyway.",
  },
  {
    id: "art-statue",
    category: "artifacts",
    name: "Guardian Statue",
    appearance: "A stone figure on a pedestal, one of a pair flanking the shrine path.",
    colonyNote: "It has been guarding for a very long time. Nobody told it to stop.",
  },
  // Origin
  {
    id: "origin-predecessor",
    category: "origin",
    name: "Predecessor Unit",
    appearance: "A deactivated robot, half-buried in ivy at the top of the overpass. Its design is an older version of your own.",
    colonyNote: "That is not you. Please continue your work.",
  },
];

export const ENTRY_BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export function stepsFor(def: EntryDef): number {
  return def.category === "flora" || def.category === "fauna" ? 3 : 1;
}

/** Stable "UNKNOWN ORGANISM ####" number derived from the entry id. */
export function unknownNumber(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9000;
  return String(1000 + h);
}
