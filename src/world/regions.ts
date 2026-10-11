import { type AbstractMesh, type Scene, type ShadowGenerator, TransformNode } from "../babylon";

/**
 * Blocks of the city that are drawn one at a time. Everything a block's builder
 * creates is parented to one root node, so switching blocks is a single
 * enable/disable. Disabled meshes skip rendering, collisions and (with the
 * `isEnabled()` checks in the pick predicates) picking. Shadow casters are taken
 * out of the shadow map too, because the light's shadow bounds would otherwise
 * still stretch over the hidden block.
 */
export type RegionId = "street" | "temple";

interface Region {
  root: TransformNode;
  casters: AbstractMesh[];
}

export class Regions {
  active: RegionId;
  private readonly regions = new Map<RegionId, Region>();
  private readonly listeners: ((id: RegionId) => void)[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly shadows: ShadowGenerator,
    initial: RegionId,
  ) {
    this.active = initial;
  }

  onChange(fn: (id: RegionId) => void): void {
    this.listeners.push(fn);
  }

  /** Runs `build` and files every mesh and node it creates under region `id`. */
  capture<T>(id: RegionId, build: () => T): T {
    const meshes = new Set(this.scene.meshes);
    const nodes = new Set(this.scene.transformNodes);
    const result = build();
    let region = this.regions.get(id);
    if (!region) {
      region = { root: new TransformNode(`region:${id}`, this.scene), casters: [] };
      this.regions.set(id, region);
    }
    const added = [
      ...this.scene.meshes.filter((m) => !meshes.has(m)),
      ...this.scene.transformNodes.filter((n) => !nodes.has(n) && n !== region.root),
    ];
    const renderList = this.shadows.getShadowMap()?.renderList ?? [];
    for (const node of added) {
      if (!node.parent) node.parent = region.root;
    }
    const inRegion = (m: AbstractMesh) => {
      for (let n: TransformNode | null = m as unknown as TransformNode; n; n = n.parent as TransformNode | null) {
        if (n === region.root) return true;
      }
      return false;
    };
    // Union with earlier captures: a hidden region's casters are no longer in the list.
    region.casters = [...new Set([...region.casters, ...renderList.filter(inRegion)])];
    this.apply(id);
    return result;
  }

  /** Shows `id` and hides every other region. */
  activate(id: RegionId): void {
    if (id === this.active) return;
    this.active = id;
    for (const r of this.regions.keys()) this.apply(r);
    for (const fn of this.listeners) fn(id);
  }

  private apply(id: RegionId): void {
    const region = this.regions.get(id)!;
    const on = id === this.active;
    region.root.setEnabled(on);
    const list = this.shadows.getShadowMap()?.renderList;
    if (!list) return;
    for (const m of region.casters) {
      const i = list.indexOf(m);
      if (on && i < 0) list.push(m);
      if (!on && i >= 0) list.splice(i, 1);
    }
  }
}
