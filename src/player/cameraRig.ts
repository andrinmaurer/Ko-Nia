import { Ray, Scene, UniversalCamera, Vector3 } from "../babylon";
import type { Input } from "../input";
import type { Robot } from "./robot";

export type CameraMode = "third" | "first";

const MOUSE_SENSITIVITY = 0.0022;
const THIRD_PERSON_DISTANCE = 4.5;
const THIRD_PERSON_HEIGHT = 0.6;
const MIN_PITCH = -1.2;
const MAX_PITCH = 1.3;

/**
 * One camera driven manually so first and third person share the same yaw/pitch
 * and switching is instant.
 */
export class CameraRig {
  readonly camera: UniversalCamera;
  mode: CameraMode = "third";
  yaw = 0;
  pitch = 0.15;
  private currentDistance = THIRD_PERSON_DISTANCE;

  constructor(private readonly scene: Scene, private readonly robot: Robot) {
    this.camera = new UniversalCamera("playerCamera", Vector3.Zero(), scene);
    this.camera.minZ = 0.05;
    this.camera.fov = 1.05;
    this.camera.inputs.clear();
  }

  toggleMode(): void {
    this.mode = this.mode === "third" ? "first" : "third";
    this.robot.setBodyVisible(this.mode === "third");
  }

  update(dt: number, input: Input): void {
    const look = input.consumeLook(dt);
    this.yaw += look.x * MOUSE_SENSITIVITY;
    this.pitch = clamp(this.pitch + look.y * MOUSE_SENSITIVITY, MIN_PITCH, MAX_PITCH);

    const dir = new Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    if (this.mode === "first") {
      this.camera.position.copyFrom(this.robot.eyePosition);
    } else {
      const pivot = this.robot.eyePosition.add(new Vector3(0, THIRD_PERSON_HEIGHT, 0));
      // Pull the camera in front of walls so it never clips into buildings.
      const back = dir.scale(-1);
      const hit = this.scene.pickWithRay(
        new Ray(pivot, back, THIRD_PERSON_DISTANCE),
        (m) => m.checkCollisions && m.isVisible,
      );
      const target = hit?.hit ? Math.max(0.6, hit.distance - 0.3) : THIRD_PERSON_DISTANCE;
      // Snap in fast, ease back out slowly.
      this.currentDistance =
        target < this.currentDistance ? target : this.currentDistance + (target - this.currentDistance) * Math.min(1, 4 * dt);
      this.camera.position.copyFrom(pivot.add(back.scale(this.currentDistance)));
    }
    this.camera.setTarget(this.camera.position.add(dir));
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
