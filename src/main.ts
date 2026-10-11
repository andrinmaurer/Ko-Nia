import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  Vector3,
} from "./babylon";
import type { Scannable, GameContext, LifeForm } from "./game/context";
import { DayCycle } from "./game/dayCycle";
import { Playtest } from "./game/playtest";
import { QualityController } from "./game/quality";
import { Input, LOCK_CHANGE } from "./input";
import { clearSave, Logbook, readSave, writeSave } from "./discovery/logbook";
import { Scanner } from "./discovery/scanner";
import { CameraRig } from "./player/cameraRig";
import { Robot } from "./player/robot";
import { MAX_ENERGY, MAX_HEALTH, RobotStatus } from "./player/status";
import { Hud } from "./ui/hud";
import { icon } from "./ui/icons";
import { LogbookView } from "./ui/logbookView";
import { createAnimals, createStaticDiscoveries } from "./world/life/animals";
import { createPlants } from "./world/life/plants";
import { RelayStation } from "./world/relay";
import { buildShrineStreet } from "./world/shrineStreet";
import { Sky } from "./world/sky";
import { Wind } from "./world/wind";

type State = "start" | "playing" | "paused" | "logbook" | "transition";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const startScreen = document.getElementById("start") as HTMLDivElement;
const startMenu = document.getElementById("start-menu") as HTMLDivElement;

// Resolution is managed by QualityController (no automatic device-ratio scaling).
const engine = new Engine(canvas, true, { stencil: true, powerPreference: "high-performance" }, false);
const scene = new Scene(engine);
scene.collisionsEnabled = true;
scene.skipPointerMovePicking = true;

// Lighting follows the day/night cycle; see applyLighting().
const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
sky.groundColor = new Color3(0.25, 0.28, 0.22);
const sun = new DirectionalLight("sun", new Vector3(-0.55, -1, 0.35), scene);
sun.position = new Vector3(40, 70, -25);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 0.012;
scene.ambientColor = new Color3(0.3, 0.32, 0.3);
const glowLayer = new GlowLayer("glowLayer", scene, { blurKernelSize: 16, mainTextureRatio: 0.25 });
glowLayer.intensity = 0.9;

const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.bias = 0.002;

const skyDome = new Sky(scene);
const world = buildShrineStreet(scene, shadows);
const input = new Input(canvas);
const robot = new Robot(scene, world.spawn);
const rig = new CameraRig(scene, robot);
rig.yaw = world.spawnYaw;
robot.visual.rotation.y = world.spawnYaw;
for (const m of robot.visual.getChildMeshes()) shadows.addShadowCaster(m);

const hud = new Hud();
const time = new DayCycle();
const wind = new Wind();
const status = new RobotStatus();
const logbook = new Logbook();
const relay = new RelayStation(scene, world.relayStation, world.spawn, world.spawnYaw);

const ctx: GameContext = {
  scene,
  robot,
  status,
  time,
  wind,
  logbook,
  robotSpeed: 0,
  caption: (text, seconds) => hud.caption(text, seconds),
  hitRobot: (amount, push) => {
    status.damage(amount);
    robot.push(push);
    hud.setHealth(status.health, MAX_HEALTH);
    hud.notice(status.disabled ? "" : "Damage taken. Minor damage repairs itself slowly.");
  },
};

const life: LifeForm[] = [...createPlants(ctx, shadows), ...createAnimals(ctx, shadows)];
const scannables: Scannable[] = [...life.flatMap((l) => l.scannables), ...createStaticDiscoveries(ctx)];
const scanner = new Scanner(ctx, rig.camera, hud, scannables, save);

// --- Rendering cost ------------------------------------------------------------

// Surface textures never change after load.
for (const m of scene.materials) if (m.name.startsWith("surface:") || m.name.startsWith("card:")) m.freeze();
const quality = new QualityController(engine, shadows, glowLayer);

let state: State = "start";
const logbookView = new LogbookView(logbook, time, closeLogbook);

// --- Save / load -------------------------------------------------------------

const saved = readSave();
if (saved) {
  logbook.load(saved.logbook);
  relay.setActivated(saved.relayActivated);
  time.day = saved.day;
  time.hours = saved.hours;
}
const playtest = new Playtest(logbook, !saved);
renderMenu(saved ? "continue" : "start");

/** Title / pause menu. "New game" clears the local save. */
function renderMenu(mode: "start" | "continue" | "paused"): void {
  const first = mode === "start" ? "Start" : "Continue";
  startMenu.innerHTML =
    `<button class="kn-menu-item" data-action="play" aria-current="true">${icon("play")}${first}</button>` +
    (mode === "start" ? "" : `<button class="kn-menu-item" data-action="new">${icon("plus")}New game</button>`) +
    (mode === "paused" ? `<button class="kn-menu-item" data-action="report">${icon("clipboard")}Copy playtest report</button>` : "");
}

/** Copies the playtest report; where the clipboard is blocked, shows it for manual copying. */
async function copyReport(button: HTMLElement): Promise<void> {
  const text = playtest.report();
  try {
    await navigator.clipboard.writeText(text);
    button.innerHTML = `${icon("check")}Report copied`;
  } catch {
    const area = document.createElement("textarea");
    area.className = "playtest-report";
    area.readOnly = true;
    area.value = text;
    button.replaceWith(area);
    area.select();
  }
}

startMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === "play") input.requestLock();
  if (action === "report") void copyReport((e.target as HTMLElement).closest<HTMLElement>("[data-action]")!);
  if (action === "new") {
    clearSave();
    location.reload();
  }
});

let lastSave = performance.now();

function save(): void {
  lastSave = performance.now();
  writeSave({ version: 1, logbook: logbook.toJSON(), relayActivated: relay.activated, day: time.day, hours: time.hours });
}

// --- Onboarding hints (only for a new game) -----------------------------------

const tutorial = { active: !saved, elapsed: 0, lensOpened: false, scanned: false, logbookOpened: false };

function updateTutorial(dt: number): void {
  if (!tutorial.active) return;
  tutorial.elapsed += dt;
  if (!tutorial.lensOpened) {
    hud.hint(tutorial.elapsed < 8 ? "<b>WASD</b> move · <b>Mouse</b> look around" : "<b>Right click</b> to open the scanner lens");
  } else if (!tutorial.scanned) {
    hud.hint("Aim at something and <b>left click</b> to scan · <b>← →</b> change scan mode");
  } else if (!tutorial.logbookOpened) {
    hud.hint("<b>Tab</b> opens the Logbook");
  } else {
    hud.hint(undefined);
    tutorial.active = false;
  }
}

// --- State changes -----------------------------------------------------------

canvas.addEventListener("click", () => {
  if (!input.locked && state !== "logbook") input.requestLock();
});
document.addEventListener(LOCK_CHANGE, () => {
  if (input.locked) {
    if (input.freeMouse && state === "start") hud.notice("Mouse look is limited here: move the cursor towards an edge to turn.");
    if (state === "start") {
      hud.toast("Systems online", "Explorer unit", { kind: "system", field: saved ? "Welcome back." : "First activation." });
    }
    if (state !== "transition") state = "playing";
  } else if (state === "playing") {
    state = "paused";
    renderMenu("paused");
  }
  startScreen.classList.toggle("hidden", input.locked || state === "logbook");
});

function openLogbook(): void {
  state = "logbook";
  tutorial.logbookOpened = true;
  playtest.logbookOpened();
  logbookView.open();
  input.releaseLock();
  startScreen.classList.add("hidden");
}

function closeLogbook(): void {
  logbookView.close();
  state = "paused";
  renderMenu("paused");
  startScreen.classList.remove("hidden");
  input.requestLock();
}

async function transition(midpoint: () => void): Promise<void> {
  const previous = state;
  state = "transition";
  for (let i = 0; i <= 10; i++) {
    hud.setFade(i / 10);
    await sleep(40);
  }
  midpoint();
  await sleep(400);
  for (let i = 10; i >= 0; i--) {
    hud.setFade(i / 10);
    await sleep(40);
  }
  state = previous === "transition" ? "playing" : previous;
  if (!input.locked && state === "playing") state = "paused";
}

function useRelay(): void {
  const first = !relay.activated;
  relay.setActivated(true);
  status.restore();
  hud.setHealth(status.health, MAX_HEALTH);
  save();
  if (first) hud.toast("Relay Station activated", "Respawn point set", { kind: "system", field: "Progress saved" });
  else hud.toast("Relay Station", "Recharged and repaired", { kind: "system", field: "Progress saved" });
}

function restAtRelay(): void {
  const target = time.isNight || time.hours >= 17 ? 7 : 20;
  void transition(() => {
    time.advanceTo(target);
    status.restore();
    save();
    hud.caption(target === 7 ? "Resting until morning…" : "Resting until nightfall…", 3);
  });
}

function respawn(): void {
  playtest.disabled();
  void transition(() => {
    robot.teleport(relay.spawn, relay.spawnYaw);
    rig.yaw = relay.spawnYaw;
    status.restore();
    hud.setHealth(status.health, MAX_HEALTH);
    hud.toast("Unit disabled", "Restored at Relay Station", { kind: "system", field: "Your discoveries are safe." });
  });
}

// --- Frame loop --------------------------------------------------------------

let fpsTimer = 0;
let autosaveTimer = 30;

scene.onBeforeRenderObservable.add(() => {
  const real = engine.getDeltaTime() / 1000;
  if (state === "playing") {
    quality.update(real);
    playtest.sampleFrame(real, quality.label);
  }
  frame(Math.min(real, 0.05));
});

function frame(dt: number): void {
  hud.update(dt);

  if (state === "logbook") {
    if (input.wasPressed("Tab") || input.wasPressed("Escape")) closeLogbook();
  } else if (state === "playing") {
    updateGame(dt);
  }
  input.endFrame();
  applyLighting();

  fpsTimer -= dt;
  if (fpsTimer <= 0) {
    fpsTimer = 0.5;
    hud.setFps(`${engine.getFps().toFixed(0)} FPS · ${quality.label} · ${rig.mode === "first" ? "1st" : "3rd"} person`);
  }
}

function updateGame(dt: number): void {
  playtest.update(dt);
  if (input.wasPressed("KeyV")) rig.toggleMode();
  if (input.wasPressed("Tab")) {
    openLogbook();
    return;
  }
  if (input.wasPressed("Mouse2")) {
    scanner.toggleLens();
    tutorial.lensOpened ||= scanner.lensOn;
  }
  if (input.wasPressed("ArrowLeft")) scanner.cycleMode(-1);
  if (input.wasPressed("ArrowRight")) scanner.cycleMode(1);
  if (input.wasPressed("Mouse0") && scanner.lensOn) {
    scanner.scan();
    playtest.scanned();
    tutorial.scanned ||= logbook.completion() > 0;
  }

  time.update(dt);
  wind.update(dt);

  const moved = robot.update(dt, input, rig.yaw, rig.mode === "first", {
    canSprint: true,
    depleted: status.depleted,
  });
  ctx.robotSpeed = moved / dt;
  status.update(dt, moved, robot.isSprinting, time.daylight);
  rig.update(dt, input);
  for (const l of life) l.update(dt);
  scanner.update(dt);

  // Relay Station interaction.
  if (relay.inRange(robot.position)) {
    const restUntil = time.isNight || time.hours >= 17 ? "morning" : "nightfall";
    const minutes = Math.round((performance.now() - lastSave) / 60000);
    hud.console(
      "Relay Station",
      relay.activated
        ? [
            { key: "E", icon: "save", label: "Save and recharge", sub: `Last save: ${minutes < 1 ? "just now" : `${minutes} min ago`} · energy ${Math.round((status.energy / MAX_ENERGY) * 100)}%`, primary: true },
            { key: "R", icon: restUntil === "morning" ? "sun" : "moon", label: `Rest until ${restUntil}`, sub: "Time passes while the unit recharges" },
            { key: "Tab", icon: "book", label: "Open Logbook", sub: `${Math.round(logbook.completion() * 100)}% complete` },
          ]
        : [{ key: "E", icon: "zap", label: "Activate", sub: "Sets your respawn point and saves", primary: true }],
    );
    if (input.wasPressed("KeyE")) useRelay();
    if (input.wasPressed("KeyR") && relay.activated) restAtRelay();
  } else {
    hud.console(undefined);
  }

  if (status.disabled) respawn();

  hud.setEnergy(status.energy, MAX_ENERGY);
  hud.setHealth(status.health, MAX_HEALTH);
  const toRelay = relay.position.subtract(robot.position);
  hud.setCompass(rig.yaw, robot.position.y, Math.atan2(toRelay.x, toRelay.z), Math.hypot(toRelay.x, toRelay.z));
  if (status.depleted) hud.notice("Energy depleted. Recharge in sunlight or at the Relay Station.");

  updateTutorial(dt);
  autosaveTimer -= dt;
  if (autosaveTimer <= 0) {
    autosaveTimer = 30;
    save();
  }
}

// --- Lighting ----------------------------------------------------------------

const DAY_SKY = new Color3(0.62, 0.7, 0.74);
const NIGHT_SKY = new Color3(0.04, 0.06, 0.1);

function applyLighting(): void {
  const d = time.daylight;
  sun.direction = time.sunDirection;
  sun.intensity = 1.4 * d;
  sun.diffuse = Color3.Lerp(new Color3(1, 0.6, 0.4), new Color3(1, 0.9, 0.75), d);
  sky.intensity = 0.35 + 0.6 * d;
  sky.diffuse = Color3.Lerp(new Color3(0.35, 0.45, 0.75), new Color3(0.75, 0.82, 0.9), d);
  const skyColor = Color3.Lerp(NIGHT_SKY, DAY_SKY, d);
  scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);
  skyDome.setTint(Color3.Lerp(new Color3(0.06, 0.08, 0.16), new Color3(1, 1, 1), d));
  scene.fogColor = Color3.Lerp(NIGHT_SKY, new Color3(0.66, 0.72, 0.74), d);
}

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Handle for automated browser tests and debugging in the console.
declare global {
  interface Window {
    __konia?: Record<string, unknown>;
  }
}
window.__konia = {
  robot, rig, scene, input, time, wind, status, logbook, scanner, relay, hud, life, scannables, ctx, playtest,
  /** Skips the pointer-lock click (headless tests). */
  start: () => {
    state = "playing";
    startScreen.classList.add("hidden");
  },
  /** Runs `steps` fixed frames without rendering (headless tests). */
  tick: (dt: number, steps = 1) => {
    for (let i = 0; i < steps; i++) frame(dt);
    rig.camera.computeWorldMatrix();
    for (const m of scene.meshes) m.computeWorldMatrix(true);
  },
  state: () => state,
};
