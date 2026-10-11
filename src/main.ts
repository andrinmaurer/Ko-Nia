import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { Input } from "./input";
import { CameraRig } from "./player/cameraRig";
import { Robot } from "./player/robot";
import { buildShrineStreet } from "./world/shrineStreet";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const startScreen = document.getElementById("start") as HTMLDivElement;
const hudMode = document.getElementById("hud-mode") as HTMLDivElement;
const hudFps = document.getElementById("hud-fps") as HTMLDivElement;

const engine = new Engine(canvas, true, { stencil: true }, true);
const scene = new Scene(engine);
scene.collisionsEnabled = true;

// Early morning after rain: low warm sun, cool sky, light mist at street level.
scene.clearColor = new Color4(0.62, 0.7, 0.74, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 0.012;
scene.fogColor = new Color3(0.66, 0.72, 0.74);
scene.ambientColor = new Color3(0.3, 0.32, 0.3);

const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
sky.intensity = 0.8;
sky.diffuse = new Color3(0.75, 0.82, 0.9);
sky.groundColor = new Color3(0.25, 0.28, 0.22);

const sun = new DirectionalLight("sun", new Vector3(-0.55, -1, 0.35), scene);
sun.position = new Vector3(40, 70, -25);
sun.intensity = 1.4;
sun.diffuse = new Color3(1, 0.86, 0.68);

const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.bias = 0.002;

const world = buildShrineStreet(scene, shadows);
const input = new Input(canvas);
const robot = new Robot(scene, world.spawn);
const rig = new CameraRig(scene, robot);
rig.yaw = world.spawnYaw;
robot.visual.rotation.y = world.spawnYaw;
for (const m of robot.visual.getChildMeshes()) shadows.addShadowCaster(m);

startScreen.addEventListener("click", () => input.requestLock());
canvas.addEventListener("click", () => {
  if (!input.locked) input.requestLock();
});
document.addEventListener("pointerlockchange", () => {
  startScreen.classList.toggle("hidden", input.locked);
});

let fpsTimer = 0;
scene.onBeforeRenderObservable.add(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
  if (input.wasPressed("KeyV")) rig.toggleMode();
  robot.update(dt, input, rig.yaw, rig.mode === "first");
  rig.update(dt, input);
  input.endFrame();

  fpsTimer -= dt;
  if (fpsTimer <= 0) {
    fpsTimer = 0.5;
    hudFps.textContent = `${engine.getFps().toFixed(0)} FPS`;
    hudMode.textContent = rig.mode === "first" ? "FIRST PERSON" : "THIRD PERSON";
  }
});

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

// Handle for automated browser tests and debugging in the console.
declare global {
  interface Window {
    __konia?: { robot: Robot; rig: CameraRig; scene: Scene; input: Input };
  }
}
window.__konia = { robot, rig, scene, input };
