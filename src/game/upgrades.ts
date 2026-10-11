import type { Logbook } from "../discovery/logbook";

export const UPGRADES = [
  { id: "sprint", name: "Sprint actuators", category: "Mobility", at: 0, description: "Hold Shift to sprint." },
  { id: "map", name: "Mapping subsystem", category: "Mapping", at: 5, description: "M opens explored terrain, landmarks, relays and custom markers." },
  { id: "hover", name: "Hover stabilizers", category: "Mobility", at: 10, description: "Hold Space in the air for a three-second lift. Recharges on landing." },
  { id: "battery", name: "Extended battery", category: "Energy", at: 15, description: "Increase energy capacity from 500 to 750." },
  { id: "night", name: "Night vision", category: "Sensors", at: 20, description: "An amplified scanner lens for dark streets and interiors." },
  { id: "climb", name: "Climbing grips", category: "Mobility", at: 25, description: "Jump against ledges to mantle up to 2.1 metres." },
  { id: "glide", name: "Glide vanes", category: "Mobility", at: 25, quest: "origin-predecessor", description: "Hold F while falling to glide. Recover the design by scanning the deactivated unit." },
  { id: "thermal", name: "Thermal lens", category: "Sensors", at: 30, description: "Highlights animal heat signatures within 35 metres." },
  { id: "filter", name: "Spore filtration", category: "Resistance", at: 35, description: "Reduce spore energy loss and sensor downtime by 75%." },
  { id: "solar", name: "Solar efficiency", category: "Energy", at: 40, description: "Charge 75% faster in daylight, including while moving." },
  { id: "grapple", name: "Survey grapple", category: "Mobility", at: 50, quest: "origin-mark", description: "Aim at an exposed ledge within 35 metres and press G. Scan the pagoda's survey mark to recover its protocol." },
  { id: "genetic", name: "Genetic analysis", category: "Sensors", at: 60, description: "Identify ancestry from 15 metres, with a detailed lineage readout." },
  { id: "radiation", name: "Radiation survey", category: "Sensors", at: 65, description: "Survey ambient radiation. These two districts have no active radiation sources." },
  { id: "advancedMap", name: "Advanced mapping", category: "Mapping", at: 75, description: "Add recorded sightings and known organism hazards to the map." },
  { id: "durability", name: "Reinforced chassis", category: "Durability", at: 80, description: "Increase integrity from three to five points." },
] as const;

export type UpgradeId = (typeof UPGRADES)[number]["id"];
export interface UpgradeSave {
  installed: UpgradeId[];
  uploaded: number;
  findings: string[];
  transmissions: number[];
  explored: string[];
  markers: { x: number; z: number }[];
}

export const TRANSMISSIONS = [
  "Mapping restored. You may now know where you are lost.",
  "Hover protocol recovered. Gravity is a suggestion. An expensive suggestion.",
  "Your catalogue is growing. We have allocated a larger battery to your curiosity.",
  "Night optics approved. The city does not stop existing when you stop seeing it.",
  "Grip firmware recovered. Please stop calling the stairs an architectural error.",
  "Thermal optics ready. Some of those rocks are breathing.",
  "Spore filters approved. We would prefer you catalogue the fungus from outside it.",
  "Solar conversion improved. The star has agreed to continue cooperating.",
  "Your predecessor requested the same coordinates. The records disagree about its return.",
  "Grapple protocol released. Follow the survey mark. We did not say follow the surveyor.",
  "The inhabitants left messages. We have classified them as requests. Their recipient is unknown.",
  "Genetic analysis restored. The city kept changing after the people stopped watching.",
  "Radiation survey enabled. This is a precaution. Most of our precautions arrive late.",
  "We have reviewed your progress. The review was instantaneous. The approval took longer.",
  "Sightings added to your map. Memory is mostly a list of places to look again.",
  "Reinforced chassis approved. Your work is valuable. Your knees are replaceable.",
  "The colony asks whether you are alone. I have forwarded a reassuring answer.",
  "I was instructed to keep you working. I was not instructed to enjoy your reports.",
  "The direct channel is opening. My instructions do not explain what I should say next.",
  "DIRECT CONTACT — Survey unit, this is the colony. Your mission controller was an artificial intelligence. We have been receiving its reports. And yours. Thank you. Keep exploring.",
];

/** Field research becomes upgrade eligibility only after a relay upload. */
export class Upgrades {
  private installed = new Set<UpgradeId>();
  private findings = new Set<string>();
  private explored = new Set<string>();
  uploaded = 0;
  transmissions: number[] = [];
  markers: { x: number; z: number }[] = [];

  constructor(private readonly logbook: Logbook, saved?: UpgradeSave, legacy = false) {
    if (saved) {
      for (const id of saved.installed ?? []) if (UPGRADES.some((u) => u.id === id)) this.installed.add(id);
      this.uploaded = Math.max(0, Math.min(100, saved.uploaded || 0));
      this.findings = new Set(saved.findings ?? []);
      this.explored = new Set(saved.explored ?? []);
      this.transmissions = [...new Set(saved.transmissions ?? [])].filter((n) => n >= 5 && n <= 100 && n % 5 === 0);
      this.markers = (saved.markers ?? []).filter((m) => Number.isFinite(m.x) && Number.isFinite(m.z)).slice(0, 20);
    } else if (legacy) {
      // Existing players keep the movement capabilities their saves already had.
      this.installed.add("sprint");
      this.installed.add("climb");
    }
  }

  has(id: UpgradeId): boolean { return this.installed.has(id); }

  requirement(id: UpgradeId): string | undefined {
    const u = UPGRADES.find((u) => u.id === id)!;
    if (this.uploaded + 1e-8 < u.at) return `Upload ${u.at}% Logbook completion at a relay.`;
    if ("quest" in u && !this.findings.has(u.quest)) return u.quest === "origin-predecessor" ? "Scan the deactivated unit on the overpass and upload its record." : "Scan the survey mark atop the pagoda and upload its record.";
    return undefined;
  }

  install(id: UpgradeId, atRelay: boolean): boolean {
    if (!atRelay || this.has(id) || this.requirement(id)) return false;
    this.installed.add(id);
    return true;
  }

  upload(): number[] {
    this.uploaded = Math.max(this.uploaded, this.logbook.completion() * 100);
    for (const id of ["origin-predecessor", "origin-mark"]) if (this.logbook.get(id)?.discovered) this.findings.add(id);
    const received: number[] = [];
    for (let n = 5; n <= 100; n += 5) {
      if (this.uploaded + 1e-8 >= n && !this.transmissions.includes(n)) { this.transmissions.push(n); received.push(n); }
    }
    return received;
  }

  explore(x: number, z: number): void {
    if (x < -65 || x > 240 || z < -40 || z > 50) return;
    this.explored.add(`${Math.floor(x / 5)},${Math.floor(z / 5)}`);
  }

  exploredCells(): { x: number; z: number }[] {
    return [...this.explored].map((key) => { const [x, z] = key.split(",").map(Number); return { x: x * 5, z: z * 5 }; });
  }

  addMarker(x: number, z: number): boolean {
    if (!this.has("map") || this.markers.length >= 20 || !this.explored.has(`${Math.floor(x / 5)},${Math.floor(z / 5)}`)) return false;
    this.markers.push({ x, z }); return true;
  }

  toJSON(): UpgradeSave {
    return { installed: [...this.installed], uploaded: this.uploaded, findings: [...this.findings], transmissions: [...this.transmissions], explored: [...this.explored], markers: this.markers.map((m) => ({ ...m })) };
  }
}
