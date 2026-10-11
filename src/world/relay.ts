import { Color3, Mesh, Scene, StandardMaterial, Vector3 } from "../babylon";

const USE_RANGE = 3.5;

/** Save / respawn / recharge hub. The robot boots up next to this one. */
export class RelayStation {
  activated = false;
  private readonly glow: StandardMaterial | null;

  constructor(
    scene: Scene,
    private readonly mesh: Mesh,
    readonly spawn: Vector3,
    readonly spawnYaw: number,
  ) {
    this.glow = scene.getMaterialByName("glow") as StandardMaterial | null;
    this.setActivated(false);
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  inRange(p: Vector3): boolean {
    return Math.hypot(p.x - this.mesh.position.x, p.z - this.mesh.position.z) < USE_RANGE;
  }

  setActivated(active: boolean): void {
    this.activated = active;
    this.glow?.emissiveColor.copyFrom(active ? new Color3(0.35, 0.85, 1) : new Color3(0.08, 0.2, 0.25));
  }
}
