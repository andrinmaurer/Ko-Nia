import { coordinates, formatHour, inWorldDate, type DayCycle } from "../game/dayCycle";
import { ENTRIES, ENTRY_BY_ID, stepsFor, unknownNumber, type Category, type EntryDef } from "../discovery/entries";
import type { Logbook } from "../discovery/logbook";
import { displayName, nextHint } from "../discovery/scanner";
import { icon, type IconName } from "./icons";

type Tab = "biology" | "locations" | "artifacts" | "history" | "anomalies" | "origin";
type Sort = "discovery" | "name" | "completion";

const TABS: { id: Tab; label: string; icon: IconName; categories: Category[] }[] = [
  { id: "biology", label: "Biology", icon: "leaf", categories: ["flora", "fungi", "fauna"] },
  { id: "locations", label: "Locations", icon: "pin", categories: ["locations"] },
  { id: "artifacts", label: "Artifacts", icon: "cube", categories: ["artifacts"] },
  { id: "history", label: "History", icon: "book", categories: [] },
  { id: "anomalies", label: "Anomalies", icon: "triangle", categories: [] },
  { id: "origin", label: "Origin", icon: "ring", categories: ["origin"] },
];

const SUBCATEGORY: Partial<Record<Category, { label: string; icon: IconName }>> = {
  flora: { label: "Flora", icon: "sprout" },
  fungi: { label: "Fungi", icon: "mushroom" },
  fauna: { label: "Fauna", icon: "paw" },
};

const BREADCRUMB: Record<Category, string> = {
  flora: "FLORA / SPECIES",
  fungi: "FUNGI / SPECIES",
  fauna: "FAUNA / SPECIES",
  locations: "LOCATIONS / OLD TOWN",
  artifacts: "ARTIFACTS / OBJECT",
  origin: "ORIGIN / RECORD",
};

/**
 * The Logbook, laid out after the design system's reference sheet: category tabs on top,
 * the entry list on the left, the selected entry's facts and image in the middle,
 * its overview and observation checklist on the right.
 */
export class LogbookView {
  private readonly root: HTMLElement;
  private tab: Tab = "biology";
  private sub: Category = "flora";
  private selected: string | undefined;
  private query = "";
  private sort: Sort = "discovery";
  isOpen = false;

  constructor(private readonly logbook: Logbook, private readonly time: DayCycle, onClose: () => void) {
    this.root = document.getElementById("logbook")!;
    this.root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const entry = t.closest<HTMLElement>("[data-entry]");
      if (entry) this.select(entry.dataset.entry!);
      const tab = t.closest<HTMLElement>("[data-tab]");
      if (tab && !tab.hasAttribute("aria-disabled")) this.setTab(tab.dataset.tab as Tab);
      const sub = t.closest<HTMLElement>("[data-sub]");
      if (sub) {
        this.sub = sub.dataset.sub as Category;
        this.selected = this.firstDiscovered();
        this.render();
      }
      if (t.closest("[data-close]")) onClose();
    });
    this.root.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement;
      if (t.name === "search") this.query = t.value.toLowerCase();
      if (t.name === "sort") this.sort = t.value as Sort;
      this.renderList();
    });
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen || document.activeElement instanceof HTMLInputElement) return;
      if (e.code === "KeyQ" || e.code === "KeyE") this.cycleTab(e.code === "KeyE" ? 1 : -1);
    });
    logbook.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  open(): void {
    this.isOpen = true;
    this.selected ??= this.firstDiscovered();
    this.root.classList.add("open");
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.remove("open");
    (document.activeElement as HTMLElement | null)?.blur();
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.sub = TABS.find((t) => t.id === tab)!.categories[0];
    this.selected = this.firstDiscovered();
    this.render();
  }

  private cycleTab(step: number): void {
    const enabled = TABS.filter((t) => t.categories.length > 0);
    const i = enabled.findIndex((t) => t.id === this.tab);
    this.setTab(enabled[(i + step + enabled.length) % enabled.length].id);
  }

  private select(id: string): void {
    this.selected = id;
    this.render();
  }

  private firstDiscovered(): string | undefined {
    return ENTRIES.find((e) => e.category === this.sub && this.logbook.get(e.id).discovered)?.id;
  }

  private pct(id: string): number {
    return Math.round((this.logbook.stepsDone(id) / stepsFor(ENTRY_BY_ID.get(id)!)) * 100);
  }

  private render(): void {
    const total = Math.round(this.logbook.completion() * 100);
    const tabs = TABS.map(
      (t) => `<button class="kn-tab" data-tab="${t.id}" aria-selected="${t.id === this.tab}" ${t.categories.length === 0 ? 'aria-disabled="true"' : ""}>
        ${icon(t.icon)}${t.label}</button>`,
    ).join("");
    const cats = TABS.find((t) => t.id === this.tab)!.categories;
    const subs =
      cats.length > 1
        ? `<div class="lb-subs">${cats
            .map((c) => {
              const all = ENTRIES.filter((e) => e.category === c);
              const found = all.filter((e) => this.logbook.get(e.id).discovered).length;
              const s = SUBCATEGORY[c]!;
              return `<button class="lb-sub" data-sub="${c}" aria-selected="${c === this.sub}">${icon(s.icon)}<span>${s.label}</span><span class="lb-count">${found} / ${all.length}</span></button>`;
            })
            .join("")}</div>`
        : "";

    this.root.innerHTML = `
      <div class="lb-panel">
        <header class="lb-header">
          <div class="lb-brand"><div class="panel-title">LOGBOOK</div><div class="tagline">DISCOVER · OBSERVE · UNDERSTAND</div></div>
          <div class="lb-total">
            <div class="data">${total}% complete</div>
            <div class="kn-bar"><span style="width:${total}%"></span></div>
            <div class="data-sm lb-time">${this.time.label}</div>
          </div>
          <span class="kn-key">Q</span><nav class="kn-tabs">${tabs}</nav><span class="kn-key">E</span>
          <button class="lb-close" data-close><span class="kn-key">Tab</span> Close</button>
        </header>
        <div class="lb-body">
          <aside class="lb-left">
            ${subs}
            <div class="kn-search">
              <label class="kn-input">${icon("search")}<input name="search" placeholder="Search…" value="${this.query}" autocomplete="off"></label>
              <select class="kn-select" name="sort">
                <option value="discovery"${this.sort === "discovery" ? " selected" : ""}>Sort: Discovery</option>
                <option value="name"${this.sort === "name" ? " selected" : ""}>Sort: Name</option>
                <option value="completion"${this.sort === "completion" ? " selected" : ""}>Sort: Completion</option>
              </select>
            </div>
            <div class="kn-list lb-list" data-el="list"></div>
          </aside>
          ${this.renderEntry()}
        </div>
      </div>`;
    this.renderList();
  }

  private renderList(): void {
    const list = this.root.querySelector<HTMLElement>("[data-el=list]");
    if (!list) return;
    let entries = ENTRIES.filter((e) => e.category === this.sub);
    const name = (e: EntryDef) => {
      const p = this.logbook.get(e.id);
      return p.discovered ? displayName(e, p, this.logbook.isComplete(e.id)) : "";
    };
    if (this.query) {
      entries = entries.filter((e) => {
        const p = this.logbook.get(e.id);
        const latin = p.bio ? e.latin ?? "" : "";
        return p.discovered && `${name(e)} ${latin}`.toLowerCase().includes(this.query);
      });
    }
    const order = (e: EntryDef) => {
      const p = this.logbook.get(e.id);
      return p.discovered ? (p.day ?? 0) * 24 + (p.hour ?? 0) : Infinity;
    };
    if (this.sort === "discovery") entries.sort((a, b) => order(a) - order(b));
    if (this.sort === "name") entries.sort((a, b) => (name(a) || "~").localeCompare(name(b) || "~"));
    if (this.sort === "completion") entries.sort((a, b) => this.pct(b.id) - this.pct(a.id));

    list.innerHTML =
      entries
        .map((e) => {
          const p = this.logbook.get(e.id);
          if (!p.discovered) {
            return `<div class="kn-entry is-undiscovered"><div class="kn-thumb"></div><div><div class="kn-entry-name">Not yet scanned</div></div><span></span></div>`;
          }
          const latin = e.latin ? `<div class="kn-entry-latin">${p.bio ? e.latin : "Unknown"}</div>` : "";
          return `<div class="kn-entry" data-entry="${e.id}" aria-selected="${e.id === this.selected}">
            <div class="kn-thumb">${p.image ? `<img src="${p.image}" alt="">` : ""}</div>
            <div><div class="kn-entry-name">${name(e)}</div>${latin}</div>
            <span class="kn-entry-pct">${this.pct(e.id)}%</span></div>`;
        })
        .join("") || `<p class="caption lb-empty">No matching entries.</p>`;
  }

  private renderEntry(): string {
    if (!this.selected) {
      return `<section class="lb-main lb-blank"><p class="body">No entries here yet. Open the scanner lens with right click and scan something.</p></section>`;
    }
    const def = ENTRY_BY_ID.get(this.selected)!;
    const p = this.logbook.get(def.id);
    const steps = stepsFor(def);
    const done = this.logbook.stepsDone(def.id);
    const complete = done === steps;
    const organism = steps === 3;
    const name = displayName(def, p, complete);
    const where = p.locationId ? ENTRY_BY_ID.get(p.locationId)?.name : undefined;
    const unknown = "Unknown";

    const pills = [
      complete
        ? `<span class="kn-pill is-complete">${icon("check", "kn-icon kn-ring")}Fully researched</span>`
        : `<span class="kn-pill is-research">${ring(done / steps)}Partially researched</span>`,
      def.danger === "high" && p.discovered ? `<span class="kn-pill is-danger">${icon("triangle", "kn-icon kn-ring")}Danger: high</span>` : "",
    ].join("");

    const checklist = organism
      ? `<p class="kn-label">Observation progress</p>
         <ul class="kn-checklist">
           ${check("Initial discovery", p.discovered)}
           ${check("Biological sample", p.bio)}
           ${check(def.observation!, p.observed)}
         </ul>`
      : "";
    const hint = nextHint(def, p);

    return `
      <section class="lb-main">
        <div class="data-sm lb-crumb">${BREADCRUMB[def.category]} / ${unknownNumber(def.id)}</div>
        <h2 class="panel-title kn-upper">${name}</h2>
        ${organism ? `<div class="latin">${p.bio ? def.latin : "Scientific name unknown"}</div>` : ""}
        <div class="lb-pills">${pills}</div>
        <div class="lb-facts">
          <div class="kn-section">
            ${
              organism
                ? `<p class="kn-label">Taxonomy</p><dl class="kn-kv"><dt>Ancestry</dt><dd>${p.bio ? def.ancestry : unknown}</dd></dl>`
                : ""
            }
            <p class="kn-label">Discovery</p>
            <dl class="kn-kv">
              <dt>Location</dt><dd>${where ?? unknown}</dd>
              <dt>Coordinates</dt><dd class="is-data">${p.x !== undefined ? coordinates(p.x, p.z!) : unknown}</dd>
              <dt>Date</dt><dd class="is-data">${p.day !== undefined ? inWorldDate(p.day) : unknown}</dd>
              <dt>Time</dt><dd class="is-data">${p.hour !== undefined ? formatHour(p.hour) : unknown}</dd>
            </dl>
          </div>
          <div class="lb-image">${p.image ? `<img src="${p.image}" alt="">` : `<span class="caption">No image</span>`}</div>
        </div>
      </section>
      <section class="lb-right">
        <p class="kn-label">Overview</p>
        <p class="body">${def.appearance}</p>
        ${organism ? `<p class="kn-label">Behavior</p><p class="body">${p.observed ? def.behavior : "Not yet observed."}</p>` : ""}
        ${checklist}
        ${hint ? `<p class="body-sm lb-hint">${hint}</p>` : ""}
        ${complete ? `<div class="lb-colony"><p class="kn-label">Colony note</p><p class="body">${def.colonyNote}</p></div>` : ""}
      </section>`;
  }
}

function check(label: string, done: boolean): string {
  return `<li class="kn-check${done ? " is-done" : ""}"><span class="kn-box">${done ? icon("check", "") : ""}</span>${label}</li>`;
}

/** Small progress ring for the "Partially researched" pill. */
function ring(frac: number): string {
  const c = 2 * Math.PI * 9;
  return `<svg class="kn-ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="2.5"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 12 12)"/></svg>`;
}
