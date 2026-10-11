import { DEFAULT_SETTINGS, saveSettings, type Settings } from "../game/settings";
import { icon } from "./icons";

const VOLUME_LABELS = { volume: "Main volume", ambience: "Ambience", effects: "Effects and creatures", music: "Music" };

/**
 * Settings form shown in place of the title / pause menu. Every change applies
 * and saves immediately; "Back" returns to the menu.
 */
export class SettingsView {
  constructor(
    private readonly root: HTMLElement,
    private readonly settings: Settings,
    private readonly apply: () => void,
    private readonly back: () => void,
  ) {
    root.addEventListener("input", (e) => this.change(e.target as HTMLInputElement | HTMLSelectElement));
    root.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>("[data-settings]")?.dataset.settings;
      if (action === "back") this.back();
      if (action === "reset") {
        Object.assign(this.settings, DEFAULT_SETTINGS);
        this.commit();
        this.render();
      }
    });
  }

  render(): void {
    const s = this.settings;
    const option = (value: string | number, label: string, current: string | number) =>
      `<option value="${value}"${String(value) === String(current) ? " selected" : ""}>${label}</option>`;
    this.root.innerHTML = `
      <div class="settings">
        <p class="kn-label">Controls</p>
        <label class="settings-row"><span>Look speed</span>
          <input type="range" name="lookSpeed" min="0.25" max="3" step="0.05" value="${s.lookSpeed}">
          <output class="data-sm">${s.lookSpeed.toFixed(2)}×</output></label>
        <label class="settings-row"><span>Invert vertical look</span>
          <input type="checkbox" name="invertLook"${s.invertLook ? " checked" : ""}></label>
        <label class="settings-row"><span>Sprint</span>
          <select class="kn-select" name="sprint">${option("hold", "Hold Shift", s.sprint)}${option("toggle", "Press Shift to toggle", s.sprint)}</select></label>
        <p class="kn-label">Display</p>
        <label class="settings-row"><span>Field of view</span>
          <input type="range" name="fov" min="50" max="90" step="1" value="${s.fov}">
          <output class="data-sm">${s.fov}°</output></label>
        <label class="settings-row"><span>Graphics quality</span>
          <select class="kn-select" name="quality">${option("auto", "Automatic", s.quality)}${[5, 4, 3, 2, 1]
            .map((q) => option(q, `${q}${q === 5 ? " (highest)" : q === 1 ? " (fastest)" : ""}`, s.quality))
            .join("")}</select></label>
        <label class="settings-row"><span>Text size</span>
          <select class="kn-select" name="textSize">${[90, 100, 115, 130].map((t) => option(t, `${t}%`, s.textSize)).join("")}</select></label>
        <label class="settings-row"><span>Reduce motion and flashes</span>
          <input type="checkbox" name="reducedMotion"${s.reducedMotion ? " checked" : ""}></label>
        <label class="settings-row"><span>Show frame rate</span>
          <input type="checkbox" name="showFps"${s.showFps ? " checked" : ""}></label>
        <p class="kn-label">Sound</p>
        ${(["volume", "ambience", "effects", "music"] as const)
          .map((k) => `<label class="settings-row"><span>${VOLUME_LABELS[k]}</span>
          <input type="range" name="${k}" min="0" max="1" step="0.05" value="${s[k]}">
          <output class="data-sm">${Math.round(s[k] * 100)}%</output></label>`)
          .join("")}
        <label class="settings-row"><span>Captions for sounds</span>
          <input type="checkbox" name="subtitles"${s.subtitles ? " checked" : ""}></label>
        <div class="settings-actions">
          <button class="kn-menu-item" data-settings="back" aria-current="true">${icon("play")}Back</button>
          <button class="kn-menu-item" data-settings="reset">Reset to defaults</button>
        </div>
      </div>`;
  }

  private change(t: HTMLInputElement | HTMLSelectElement): void {
    const s = this.settings;
    switch (t.name) {
      case "lookSpeed":
        s.lookSpeed = Number(t.value);
        break;
      case "fov":
        s.fov = Number(t.value);
        break;
      case "volume":
      case "ambience":
      case "effects":
      case "music":
        s[t.name] = Number(t.value);
        break;
      case "invertLook":
      case "reducedMotion":
      case "subtitles":
      case "showFps":
        s[t.name] = (t as HTMLInputElement).checked;
        break;
      case "sprint":
        s.sprint = t.value as Settings["sprint"];
        break;
      case "quality":
        s.quality = t.value === "auto" ? "auto" : (Number(t.value) as Settings["quality"]);
        break;
      case "textSize":
        s.textSize = Number(t.value) as Settings["textSize"];
        break;
      default:
        return;
    }
    const out = t.parentElement?.querySelector("output");
    if (out) out.textContent = t.name === "fov" ? `${s.fov}°` : t.name === "lookSpeed" ? `${s.lookSpeed.toFixed(2)}×` : `${Math.round(Number(t.value) * 100)}%`;
    this.commit();
  }

  private commit(): void {
    saveSettings(this.settings);
    this.apply();
  }
}
