import type { AbstractMesh, Scene, Vector3 } from "../babylon";
import type { Logbook } from "../discovery/logbook";
import type { Robot } from "../player/robot";
import type { RobotStatus } from "../player/status";
import type { Wind } from "../world/wind";
import type { DayCycle } from "./dayCycle";

/** Shared state that world systems and creatures read each frame. */
export interface GameContext {
  scene: Scene;
  robot: Robot;
  status: RobotStatus;
  time: DayCycle;
  wind: Wind;
  logbook: Logbook;
  /** Horizontal robot speed in m/s this frame. */
  robotSpeed: number;
  /** Shows a sound caption at the bottom of the screen (no audio yet). */
  caption(text: string, seconds?: number): void;
  /** Damages the robot and pushes it in `push` direction. */
  hitRobot(amount: number, push: Vector3): void;
  /** Seconds the scanner stays clogged by spores. */
  sensorsJammed: number;
  /** The robot was caught in a spore cloud. */
  sporeHit(): void;
}

/** Something the scanner can target. Several scannables may share one Logbook entry. */
export interface Scannable {
  entryId: string;
  meshes: AbstractMesh[];
  getPosition(): Vector3;
  /** False while hidden (e.g. an animal in its burrow). Defaults to true. */
  isAvailable?(): boolean;
  /** True while the species' behavior observation is happening. */
  isConditionMet?(): boolean;
}

export interface LifeForm {
  scannables: Scannable[];
  update(dt: number): void;
}
