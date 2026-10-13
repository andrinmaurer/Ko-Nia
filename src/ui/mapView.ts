import type { Upgrades } from "../game/upgrades";
import type { Logbook } from "../discovery/logbook";
import { ENTRIES } from "../discovery/entries";
import type { Robot } from "../player/robot";
import type { RelayStation } from "../world/relay";

export class MapView {
  readonly root = document.createElement("section");
  constructor(private upgrades: Upgrades, private logbook: Logbook, private robot: Robot, private relays: RelayStation[], private save: () => void, private close: () => void) {
    this.root.className = "upgrade-panel hidden"; this.root.setAttribute("role", "dialog"); this.root.setAttribute("aria-modal", "true"); this.root.setAttribute("aria-label", "Exploration map"); document.body.append(this.root);
    this.root.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); this.root.querySelector("button")?.focus(); } });
    this.root.addEventListener("click", (e) => {
      const target = e.target as Element;
      if (target.closest("button")) { this.close(); return; }
      const marker = target.closest<SVGElement>("[data-marker]");
      if (marker) this.upgrades.markers.splice(Number(marker.dataset.marker), 1);
      else {
        const svg = this.root.querySelector("svg")!; if (!svg.contains(target)) return;
        const point = svg.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
        const matrix = svg.getScreenCTM(); if (!matrix) return;
        const world = point.matrixTransform(matrix.inverse());
        if (!this.upgrades.addMarker(world.x - 65, 50 - world.y)) { this.root.querySelector(".map-message")!.textContent = "Place markers on explored terrain (maximum 20)."; return; }
      }
      this.save(); this.render();
    });
  }
  open(): void { this.render(); this.root.classList.remove("hidden"); this.root.querySelector("button")?.focus(); }
  hide(): void { this.root.classList.add("hidden"); }
  render(): void {
    const cells = this.upgrades.exploredCells();
    const known = (x: number, z: number) => cells.some((c) => x >= c.x && x < c.x + 5 && z >= c.z && z < c.z + 5);
    const dot = (x: number, z: number, color: string, name: string) => `<circle cx="${x + 65}" cy="${50 - z}" r="1" fill="${color}"><title>${name}</title></circle>`;
    const landmarks: [string, number, number][] = [["loc-shrine-street",0,0],["loc-noodle-shop",14,12],["loc-overpass",-12,0],["loc-shrine",51,0],["loc-stair-lane",86,2],["loc-temple-gate",118,6],["loc-temple-courtyard",150,6],["loc-main-hall",190,7],["loc-pagoda",164,32],["loc-koi-pond",142,-18],["loc-arcade-entrance",276,22],["loc-flooded-arcade",305,19],["loc-arcade-roof",320,9],["loc-clock-crossing",340,19],["loc-ticket-hall",428,-6],["loc-platform",470,-12],["loc-stopped-train",500,14],["loc-maintenance-tunnel",530,-12]];
    const places = landmarks.filter(([id]) => this.logbook.get(id).discovered).map(([id,x,z]) => `<text x="${x+65}" y="${50-z}" font-size="2.8" fill="#b5dbdf">${ENTRIES.find((d) => d.id === id)!.name}</text>`).join("");
    const sightings = this.upgrades.has("advancedMap") ? ENTRIES.filter((d) => d.category !== "locations" && this.logbook.get(d.id).discovered).map((d) => {
      const entry = this.logbook.get(d.id); if (entry.x === undefined || entry.z === undefined || !known(entry.x, entry.z)) return "";
      return dot(entry.x, entry.z, d.danger === "high" ? "#ff6677" : "#f1c979", this.logbook.isComplete(d.id) ? d.name : "Recorded sighting");
    }).join("") : "";
    this.root.innerHTML = `<header><h1>Exploration map</h1><button>Close · M / Esc</button></header><p>Explored terrain · cyan relays · white robot · orange markers${this.upgrades.has("advancedMap") ? " · gold recorded sightings · red known hazards" : ""}</p><p class="map-message">Click explored terrain to mark a place. Click a marker to remove it.</p><svg class="exploration-map" viewBox="0 0 630 95" role="img" aria-label="Explored terrain and saved markers">${cells.map((c) => `<rect x="${c.x + 65}" y="${45 - c.z}" width="5" height="5" fill="#23474a" stroke="#315559" stroke-width=".1"/>`).join("")}${this.relays.filter((r) => r.activated).map((r) => dot(r.position.x, r.position.z, "#6de3f0", `${r.id} relay`)).join("")}${places}${sightings}${this.upgrades.markers.map((m, i) => `<circle data-marker="${i}" cx="${m.x + 65}" cy="${50 - m.z}" r="1.4" fill="#ff996a"><title>Marker ${i + 1} · click to remove</title></circle>`).join("")}${dot(this.robot.position.x, this.robot.position.z, "white", "Your position")}</svg><p>Only visited ground is mapped. Research and markers are saved between sessions.</p>`;
  }
}
