import type { ScanMode } from "../discovery/logbook";
import { icon, type IconName } from "./icons";

const MODE_LABELS: Record<ScanMode, string> = { visual: "Visual", bio: "Biological" };
const CARDINALS: [string, number][] = [
  ["N", 0],
  ["NE", 45],
  ["E", 90],
  ["SE", 135],
  ["S", 180],
  ["SW", 225],
  ["W", 270],
  ["NW", 315],
];
const ENERGY_CELLS = 5;

export interface ToastOptions {
  /** "bio" rings in bloom, "place" (locations, artifacts) in marker. */
  kind?: "bio" | "place" | "system";
  field?: string;
}

export interface ConsoleAction {
  key: string;
  icon: IconName;
  label: string;
  sub: string;
  primary?: boolean;
}

/**
 * Minimal, diegetic HUD built from the Ko-Nia design system (Terminal theme):
 * energy, compass and scan mode along the bottom edge, discovery toasts lower left,
 * the Relay Station console on the right.
 */
export class Hud {
  private readonly root: HTMLElement;
  private readonly el: Record<string, HTMLElement> = {};
  private noticeTimer = 0;
  private captionTimer = 0;
  private readonly toastQueue: { title: string; name: string; opts: ToastOptions }[] = [];
  private toastTimer = 0;
  private consoleKey = "";

  constructor() {
    this.root = document.getElementById("hud")!;
    this.root.innerHTML = `
      <div class="hud-lens" data-el="lens"></div>
      <div class="hud-reticle" data-el="reticle"></div>
      <div class="hud-target" data-el="target"><div data-el="targetName"></div><div class="hud-sub" data-el="targetSub"></div></div>
      <div class="hud-notice" data-el="notice"></div>
      <div class="hud-hint" data-el="hint"></div>
      <div class="kn-hud hud-bar">
        <div class="kn-energy" data-el="energyWrap">EN<span class="kn-cells" data-el="cells"></span><span data-el="energyPct"></span></div>
        <div class="hud-compass-wrap">
          <div class="kn-compass" data-el="compass"></div>
          <div class="hud-elev" data-el="elev"></div>
        </div>
        <span class="kn-mode" data-el="mode"></span>
        <span class="hud-integrity" data-el="health"></span>
      </div>
      <div class="kn-toast hud-toast" data-el="toast">
        <div class="kn-toast-mark" data-el="toastMark"></div>
        <div><div class="kn-toast-title" data-el="toastTitle"></div><div class="kn-toast-name" data-el="toastName"></div><div class="kn-toast-field" data-el="toastField"></div></div>
      </div>
      <div class="kn-console hud-console" data-el="console"></div>
      <div class="hud-caption" data-el="caption"></div>
      <div class="hud-fps" data-el="fps"></div>
      <div class="hud-shutter" data-el="shutter"></div>
      <div class="hud-fade" data-el="fade"></div>
    `;
    for (const node of this.root.querySelectorAll<HTMLElement>("[data-el]")) this.el[node.dataset.el!] = node;
    this.el.cells.innerHTML = "<i></i>".repeat(ENERGY_CELLS);
    this.setLens(false, "visual");
  }

  update(dt: number): void {
    if (this.noticeTimer > 0 && (this.noticeTimer -= dt) <= 0) this.el.notice.classList.remove("show");
    if (this.captionTimer > 0 && (this.captionTimer -= dt) <= 0) this.el.caption.classList.remove("show");
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0.3) this.el.toast.classList.remove("show");
    }
    if (this.toastTimer <= 0 && this.toastQueue.length > 0) {
      const t = this.toastQueue.shift()!;
      const kind = t.opts.kind ?? "bio";
      this.el.toastMark.className = `kn-toast-mark is-${kind}`;
      this.el.toastMark.innerHTML = icon(kind === "bio" ? "leaf" : kind === "place" ? "pin" : "ring");
      this.el.toastTitle.textContent = t.title;
      this.el.toastName.textContent = t.name;
      this.el.toastField.textContent = t.opts.field ?? "";
      this.el.toast.classList.add("show");
      this.toastTimer = 4;
    }
  }

  setLens(on: boolean, mode: ScanMode): void {
    this.root.classList.toggle("lens-on", on);
    this.root.dataset.mode = mode;
    this.el.mode.innerHTML = `${icon("scan")}${MODE_LABELS[mode]}`;
    this.el.mode.classList.toggle("is-off", !on);
    if (!on) this.setTarget(undefined);
  }

  setTarget(name: string | undefined, progress = "", inRange = true): void {
    this.el.target.classList.toggle("show", name !== undefined);
    this.el.target.classList.toggle("far", !inRange);
    this.el.reticle.classList.toggle("locked", name !== undefined);
    if (name === undefined) return;
    this.el.targetName.textContent = name;
    this.el.targetSub.textContent = inRange ? progress : `${progress} · out of range`;
  }

  notice(text: string): void {
    if (!text) return;
    this.el.notice.textContent = text;
    this.el.notice.classList.add("show");
    this.noticeTimer = 2.5;
  }

  toast(title: string, name: string, opts: ToastOptions = {}): void {
    this.toastQueue.push({ title, name, opts });
  }

  caption(text: string, seconds = 3): void {
    this.el.caption.textContent = text;
    this.el.caption.classList.add("show");
    this.captionTimer = seconds;
  }

  /** Relay Station console; pass undefined to hide it. */
  console(title: string | undefined, actions: ConsoleAction[] = []): void {
    const key = title === undefined ? "" : title + JSON.stringify(actions);
    if (key === this.consoleKey) return;
    this.consoleKey = key;
    this.el.console.classList.toggle("show", title !== undefined);
    if (title === undefined) return;
    this.el.console.innerHTML =
      `<p class="kn-console-title">${title}</p>` +
      actions
        .map(
          (a) => `<div class="kn-action${a.primary ? " is-primary" : ""}">${icon(a.icon)}
            <span class="kn-action-label">${a.label} <span class="kn-key">${a.key}</span></span>
            <span class="kn-action-sub">${a.sub}</span></div>`,
        )
        .join("");
  }

  hint(html: string | undefined): void {
    this.el.hint.innerHTML = html ?? "";
    this.el.hint.classList.toggle("show", html !== undefined);
  }

  shutter(): void {
    const s = this.el.shutter;
    s.classList.remove("flash");
    void s.offsetWidth; // restart the animation
    s.classList.add("flash");
  }

  setEnergy(energy: number, max: number): void {
    const frac = Math.max(0, Math.min(1, energy / max));
    const cells = this.el.cells.children;
    for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("is-empty", frac <= i / ENERGY_CELLS + 0.001);
    const low = frac < 0.2;
    this.el.energyWrap.classList.toggle("is-low", low);
    this.el.energyPct.textContent = low ? `${Math.round(frac * 100)}% LOW` : `${Math.round(frac * 100)}%`;
  }

  setHealth(health: number, max: number): void {
    this.el.health.textContent = health < max ? `Integrity ${health}/${max}` : "";
    this.el.health.classList.toggle("show", health < max);
  }

  /**
   * @param yaw facing in radians (0 = north, π/2 = east)
   * @param relayBearing absolute bearing to the Relay Station in radians
   */
  setCompass(yaw: number, elevation: number, relayBearing: number, relayDistance: number): void {
    const heading = toDeg(yaw);
    const marks = CARDINALS.map(([label, deg]) => mark(heading, deg, label, label === "N" ? "is-n" : ""));
    marks.push(mark(heading, toDeg(relayBearing), "◆", "is-relay"));
    this.el.compass.innerHTML = marks.join("");
    this.el.elev.textContent = `${String(Math.round(heading)).padStart(3, "0")}° · ELEV ${elevation.toFixed(0)} M · RELAY ${Math.round(relayDistance)} M`;
  }

  setFps(text: string): void {
    this.el.fps.textContent = text;
  }

  setFade(opacity: number): void {
    this.el.fade.style.opacity = String(opacity);
  }
}

function toDeg(rad: number): number {
  return (((rad * 180) / Math.PI) % 360 + 360) % 360;
}

/** A compass mark if it lies within ±90° of the heading. */
function mark(heading: number, deg: number, label: string, cls: string): string {
  const rel = ((deg - heading + 540) % 360) - 180;
  if (Math.abs(rel) > 90) return "";
  return `<span class="${cls}" style="left:${50 + (rel / 90) * 50}%">${label}</span>`;
}
