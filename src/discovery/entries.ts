/**
 * Every Logbook entry. Shrine Street content comes from
 * docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md, Temple Hill from
 * docs/blocks/02_TEMPLE_HILL_PROPOSAL.md.
 *
 * Organisms take three steps: first scan (page created), Biological scan,
 * and one behavior observation. Everything else is complete after one scan.
 */

export type Category = "flora" | "fungi" | "fauna" | "locations" | "artifacts" | "origin";

export const CATEGORY_LABELS: Record<Category, string> = {
  flora: "Biology · Flora",
  fungi: "Biology · Fungi",
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
  {
    id: "temple-cedar",
    category: "flora",
    name: "Temple Cedar",
    latin: "Cryptomeria colossa",
    observation: "Amber at sunset",
    appearance: "A colossal conifer that grew up through the roof of the temple's main hall. Beads of resin cling to its bark.",
    ancestry: "Descendant of a cedar. Its roots reach the water held in the hill under the temple, which lets it grow this tall.",
    behavior: "At sunset the resin beads catch the low light and glow amber. Its seeds drift down onto the pond, where the Gilded Carp eat them.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "The resin seems to be waiting for a particular light." },
    colonyNote: "The tallest thing for kilometres. It was here before the roof fell in and it will be here after you leave. No pressure.",
    danger: "none",
  },
  // Fungi
  {
    id: "scroll-cap",
    category: "fungi",
    name: "Scroll Cap",
    latin: "Papyromyces lamellatus",
    observation: "Feeding on scrolls",
    appearance: "Pale fungus with thin, layered caps that look like stacked paper slips. Grows on old wood in the main hall.",
    ancestry: "Descendant of a bracket fungus. It breaks down wood and paper and leaves nothing behind but dust.",
    behavior: "It prefers paper to wood: the thickest growth is on the shelves where scrolls were stored.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "It grows on wood here. Is there something it likes better?" },
    colonyNote: "It is reading the library. Very slowly, and from the outside in.",
    danger: "none",
  },
  {
    id: "censer-puffball",
    category: "fungi",
    name: "Censer Puffball",
    latin: "Lycoperdon turibulum",
    observation: "Releasing spores",
    appearance: "Swollen ochre puffballs crowding the dark half of the main hall.",
    ancestry: "Descendant of a puffball. The skin tightens as it ripens, and any disturbance makes it burst.",
    behavior: "Swells and hisses when something comes close, then bursts into a cloud of spores. The draught of a wind gust sets them off too. The spores clog sensors.",
    hints: { bio: "Closer analysis needed (Biological scan). Do not rush it.", observe: "They burst when the wind gusts through the hall. Watch one go off, from a safe distance." },
    colonyNote: "Not dangerous, technically. Just very rude to your sensors.",
    danger: "high",
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
  {
    id: "gilded-carp",
    category: "fauna",
    name: "Gilded Carp",
    latin: "Cyprinus auratus magnus",
    observation: "Surfacing to feed",
    appearance: "A fish over a metre long, covered in overlapping gold plates. Stays deep in the temple pond.",
    ancestry: "Descendant of an ornamental carp. The plates are thickened scales.",
    behavior: "Rises to gulp the cedar seeds floating on the surface, but only when everything around the pond is still.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Stand still on the bridge and wait." },
    colonyNote: "Someone once fed its ancestors from this bridge. It still remembers. Or the seeds are just there.",
    danger: "none",
  },
  {
    id: "tithe-ant",
    category: "fauna",
    name: "Tithe Ant",
    latin: "Formica decimaria",
    observation: "Back at the mound",
    appearance: "Finger-long ants marching in tidy columns across the temple courtyard.",
    ancestry: "Descendant of an ant. Larger and more organized than any ant before.",
    behavior: "Strips fallen fruit and leftovers and carries every piece along the same route to a mound under the offering racks.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "Where are they all going? Follow the column." },
    colonyNote: "Collects a share of everything that falls. Humans had a word for that.",
    danger: "none",
  },
  {
    id: "moss-tanuki",
    category: "fauna",
    name: "Moss Tanuki",
    latin: "Nyctereutes muscosus",
    observation: "Raiding the offering box",
    appearance: "Round, dog-sized animal with a masked face and a back overgrown with living moss. Sleeps on the temple gate.",
    ancestry: "Descendant of a raccoon dog. The moss grows in its thick fur and hides it on rooftops.",
    behavior: "Forages at night and is curious: it follows the robot at a distance. Its favourite stop is the hall's offering box.",
    hints: { bio: "Closer analysis needed (Biological scan).", observe: "It sleeps all day. What does it get up to at night?" },
    colonyNote: "It has decided you are interesting. We are not sure it is right.",
    danger: "none",
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
  {
    id: "loc-stair-lane",
    category: "locations",
    name: "Stair Lane",
    appearance: "Worn stone steps climbing from the shrine through a ruined building up the hill.",
    colonyNote: "Stairs. Humans built them everywhere. You may begin to see why the robots came later.",
  },
  {
    id: "loc-temple-gate",
    category: "locations",
    name: "Temple Gate",
    appearance: "A huge wooden gate, its north half collapsed into a heap of beams and tiles.",
    colonyNote: "Gates are for keeping things out. This one gave up.",
  },
  {
    id: "loc-temple-courtyard",
    category: "locations",
    name: "Temple Courtyard",
    appearance: "A wide gravel courtyard taken over by moss and ferns, lined with stone lanterns.",
    colonyNote: "Large, flat, empty. The humans liked to stand around in places like this.",
  },
  {
    id: "loc-main-hall",
    category: "locations",
    name: "Main Hall",
    appearance: "The temple's great wooden hall. Half its roof fell in where a cedar grew through it; the other half is dark.",
    colonyNote: "The biggest room in the neighbourhood. Something lives in the dark half. Several somethings.",
  },
  {
    id: "loc-pagoda",
    category: "locations",
    name: "Pagoda",
    appearance: "A five-storey tower with broken eaves, the highest point of the temple grounds.",
    colonyNote: "A tower with no use we can identify, except climbing it. We approve.",
  },
  {
    id: "loc-koi-pond",
    category: "locations",
    name: "Koi Pond",
    appearance: "An old ornamental pond, now a shallow wetland with an island and an arched red bridge.",
    colonyNote: "Water, standing still on purpose. Somebody liked looking at it.",
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
  {
    id: "art-stone-lantern",
    category: "artifacts",
    name: "Stone Lantern",
    appearance: "A carved stone post with a small window box on top, one of a row along the temple path.",
    colonyNote: "A lamp made of stone. The light went out a while ago. The stone did not notice.",
  },
  {
    id: "art-temple-bell",
    category: "artifacts",
    name: "Temple Bell",
    appearance: "A huge bronze bell, green with age, lying on its side under the ruins of its tower.",
    colonyNote: "It was hit with a log at regular intervals. We do not ask why.",
  },
  {
    id: "art-offering-box",
    category: "artifacts",
    name: "Offering Box",
    appearance: "A wooden chest with a slatted top in front of the main hall. Something has been scratching at it.",
    colonyNote: "People dropped things in. Something else takes things out. Commerce.",
  },
  {
    id: "art-scroll-shelf",
    category: "artifacts",
    name: "Scroll Shelf",
    appearance: "Shelves of rolled paper in the main hall. Most of the scrolls are fused together or eaten away.",
    colonyNote: "Records of something. The fungus got to read them first.",
  },
  {
    id: "art-wish-wall",
    category: "artifacts",
    name: "Wish Wall",
    appearance:
      "Thousands of small wooden plaques covering the end wall of the main hall, kept by the dry dark. A few are still readable in fragments: \"...let the water go down...\", \"...that the others come back for us...\", \"...one more spring here...\".",
    colonyNote: "Many requests, one address. We could not find out whether any were answered.",
  },
  // Origin
  {
    id: "origin-predecessor",
    category: "origin",
    name: "Predecessor Unit",
    appearance: "A deactivated robot, half-buried in ivy at the top of the overpass. Its design is an older version of your own.",
    colonyNote: "That is not you. Please continue your work.",
  },
  {
    id: "origin-mark",
    category: "origin",
    name: "Predecessor's Mark",
    appearance: "A sign scratched into the bronze at the top of the pagoda, in the same pattern your own unit uses to mark a surveyed point. It points further into the city.",
    colonyNote: "Someone was here before you and kept going. You should keep going too. Unrelated.",
  },
];

export const ENTRY_BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export function stepsFor(def: EntryDef): number {
  return def.category === "flora" || def.category === "fungi" || def.category === "fauna" ? 3 : 1;
}

/** Stable "UNKNOWN ORGANISM ####" number derived from the entry id. */
export function unknownNumber(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9000;
  return String(1000 + h);
}
