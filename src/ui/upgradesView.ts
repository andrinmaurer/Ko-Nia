import { UPGRADES, TRANSMISSIONS, type Upgrades, type UpgradeId } from "../game/upgrades";
import type { Logbook } from "../discovery/logbook";

export class UpgradesView {
  readonly root = document.createElement("section");
  constructor(private upgrades: Upgrades, private logbook: Logbook, private atRelay: () => boolean, private install: (id: UpgradeId) => void, private upload: () => void, private close: () => void) {
    this.root.className = "upgrade-panel hidden"; this.root.setAttribute("role", "dialog"); this.root.setAttribute("aria-modal", "true"); this.root.setAttribute("aria-label", "Robot upgrades"); document.body.append(this.root);
    this.root.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (button?.dataset.install) { this.install(button.dataset.install as UpgradeId); this.render(); }
      if (button?.dataset.action === "upload") { this.upload(); this.render(); }
      if (button?.dataset.action === "close") this.close();
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault(); buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    });
  }
  open(): void { this.render(); this.root.classList.remove("hidden"); this.root.querySelector<HTMLButtonElement>("button")?.focus(); }
  hide(): void { this.root.classList.add("hidden"); }
  render(): void {
    const relay = this.atRelay();
    this.root.innerHTML = `<header><h1>Robot upgrades</h1><button data-action="close">Close · U / Esc</button></header><p>Field research ${Math.floor(this.logbook.completion() * 100)}% · Uploaded ${Math.floor(this.upgrades.uploaded)}%</p><p>${relay ? "Relay connected. Upload discoveries, then install available upgrades." : "Visit an activated relay to upload discoveries and install upgrades."}</p><button data-action="upload" ${relay ? "" : "disabled"}>Upload, recharge and repair</button><div class="upgrade-grid">${UPGRADES.map((u) => {
      const installed = this.upgrades.has(u.id), requirement = this.upgrades.requirement(u.id);
      return `<article><small>${u.category} · ${u.at}%</small><h2>${u.name}</h2><p>${u.description}</p><p class="upgrade-requirement">${installed ? "Installed" : requirement ?? "Ready to install"}</p><button data-install="${u.id}" ${installed || requirement || !relay ? "disabled" : ""}>${installed ? "Installed" : "Install"}</button></article>`;
    }).join("")}</div><h2>Mission transmissions</h2>${this.upgrades.transmissions.length ? [...this.upgrades.transmissions].reverse().map((n) => `<details><summary>${n}% · Mission control</summary><p>${TRANSMISSIONS[n / 5 - 1]}</p></details>`).join("") : "<p>Upload 5% research to receive your first transmission.</p>"}`;
  }
}
