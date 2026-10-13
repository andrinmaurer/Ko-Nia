import {
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  Scene,
  ShadowGenerator,
  StandardMaterial,
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
import { RobotStatus } from "./player/status";
import { Hud } from "./ui/hud";
import { icon } from "./ui/icons";
import { LogbookView } from "./ui/logbookView";
import { Atmosphere } from "./world/atmosphere";
import { createAnimals, createStaticDiscoveries } from "./world/life/animals";
import { createPlants } from "./world/life/plants";
import { createArcadeDiscoveries, createArcadeLife } from "./world/life/arcadeLife";
import { buildCedarSilhouette, createTempleDiscoveries, createTempleLife } from "./world/life/templeLife";
import { buildArcadePassage, passageRegionAt, PASSAGE } from "./world/arcadePassage";
import { buildFloodedArcade, waterAt } from "./world/floodedArcade";
import { createStationDiscoveries, createStationLife } from "./world/life/stationLife";
import { buildStationPassage, buildSunkenStation, stationRegionAt, undergroundAt } from "./world/sunkenStation";
import { Regions } from "./world/regions";
import { RelayStation } from "./world/relay";
import { buildShrineStreet } from "./world/shrineStreet";
import { buildStairLane, laneRegionAt } from "./world/stairLane";
import { buildTempleHill } from "./world/templeHill";
import { Sky } from "./world/sky";
import { Wind } from "./world/wind";

import { Upgrades, TRANSMISSIONS, type UpgradeId } from "./game/upgrades";
import { UpgradesView } from "./ui/upgradesView";
import { MapView } from "./ui/mapView";
import { loadSettings } from "./game/settings";
import { SettingsView } from "./ui/settingsView";
import { TitleBackdrops } from "./ui/titleBackdrops";
import { Soundscape } from "./audio/soundscape";
import * as sfx from "./audio/cues";

type State = "start" | "playing" | "paused" | "logbook" | "upgrades" | "map" | "transition";

/** Wading: speed factor and extra energy per metre. */
const WADE_SPEED = 0.55;
const WADE_COST_PER_METRE = 0.6;

/** Spore cloud: how long the scanner stays offline, and the energy it costs. */
const SPORE_SECONDS = 20;
const SPORE_ENERGY = 40;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const startScreen = document.getElementById("start") as HTMLDivElement;
const startMenu = document.getElementById("start-menu") as HTMLDivElement;
const titleBackdrops = new TitleBackdrops(startScreen);
document.querySelector("#start-controls summary")!.innerHTML = `${icon("keyboard")}Controls`;

// Resolution is managed by QualityController (no automatic device-ratio scaling).
const engine = new Engine(canvas, true, { stencil: true, powerPreference: "high-performance" }, false);
const scene = new Scene(engine);
scene.collisionsEnabled = true;
scene.skipPointerMovePicking = true;

// Lighting follows the day/night cycle; see world/atmosphere.ts.
const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
const sun = new DirectionalLight("sun", new Vector3(-0.55, -1, 0.35), scene);
sun.position = new Vector3(40, 70, -25);
const glowLayer = new GlowLayer("glowLayer", scene, { blurKernelSize: 16, mainTextureRatio: 0.25 });
glowLayer.intensity = 0.9;

const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.bias = 0.002;

// Blocks drawn one at a time (see world/regions.ts). The passages between two
// blocks are drawn with either of them.
const regions = new Regions(scene, shadows, "street");
const world = regions.capture("street", () => {
  const street = buildShrineStreet(scene, shadows);
  buildCedarSilhouette(scene);
  return street;
});
regions.capture(["street", "temple"], () => buildStairLane(scene, shadows));
const temple = regions.capture("temple", () => buildTempleHill(scene, shadows));
regions.capture(["temple", "arcade"], () => buildArcadePassage(scene, shadows));
const arcade = regions.capture("arcade", () => {
  const built = buildFloodedArcade(scene, shadows);
  buildCedarSilhouette(scene);
  return built;
});
regions.capture(["arcade", "station"], () => buildStationPassage(scene, shadows));
const station = regions.capture("station", () => buildSunkenStation(scene, shadows));
const atmosphere = new Atmosphere(scene, sun, sky, new Sky(scene));
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
const saved = readSave();
const upgrades = new Upgrades(logbook, saved?.upgrades, !!saved && !saved.upgrades);
status.configure(upgrades.has("battery"), upgrades.has("durability"), upgrades.has("solar"));
const relays = [
  new RelayStation("street", world.relayStation, world.spawn, world.spawnYaw, scene.getMaterialByName("glow") as StandardMaterial | null),
  new RelayStation("temple", temple.relayStation, temple.spawn, temple.spawnYaw, temple.relayGlow),
  new RelayStation("arcade", arcade.relayStation, arcade.spawn, arcade.spawnYaw, arcade.relayGlow),
  new RelayStation("station", station.relayStation, station.spawn, station.spawnYaw, station.relayGlow),
];
/** Where the robot respawns: the Relay Station it used last. */
let homeRelay = relays[0];

const ctx: GameContext = {
  scene,
  robot,
  status,
  time,
  wind,
  logbook,
  upgrades,
  robotSpeed: 0,
  caption: (text, seconds) => {
    // Creature captions are the subtitles for their sounds.
    sound.caption(text);
    if (settings.subtitles) hud.caption(text, seconds);
  },
  hitRobot: (amount, push) => {
    sound.play(sfx.hit, undefined, "effects", 2, 0.3);
    status.damage(amount);
    robot.push(push);
    hud.setHealth(status.health, status.maxHealth);
    hud.notice(status.disabled ? "" : "Damage taken. Minor damage repairs itself slowly.");
  },
  sensorsJammed: 0,
  sporeHit: () => {
    ctx.sensorsJammed = SPORE_SECONDS * (upgrades.has("filter") ? .25 : 1);
    status.energy = Math.max(0, status.energy - SPORE_ENERGY * (upgrades.has("filter") ? .25 : 1));
    if (scanner.lensOn) scanner.toggleLens();
    hud.notice("Spores! Sensors clogged. Scanner offline until they clear.");
  },
};

const life: LifeForm[] = [
  ...regions.capture("street", () => [...createPlants(ctx, shadows), ...createAnimals(ctx, shadows)]),
  ...regions.capture("temple", () => createTempleLife(ctx, shadows)),
  ...regions.capture("arcade", () => createArcadeLife(ctx, shadows, arcade)),
  ...regions.capture("station", () => createStationLife(ctx, shadows, station)),
];
const scannables: Scannable[] = [
  ...life.flatMap((l) => l.scannables),
  ...regions.capture("street", () => createStaticDiscoveries(ctx)),
  ...regions.capture("temple", () => createTempleDiscoveries(ctx, temple)),
  ...regions.capture("arcade", () => createArcadeDiscoveries(ctx, arcade)),
  ...regions.capture("station", () => createStationDiscoveries(ctx, station)),
];
const scanner = new Scanner(ctx, rig.camera, hud, scannables, save);

// --- Rendering cost ------------------------------------------------------------

// Surface textures never change after load.
for (const m of scene.materials) if (m.name.startsWith("surface:") || m.name.startsWith("card:")) m.freeze();
// The glow pass re-draws every mesh; cut-out foliage, signs and the sky never glow
// and rarely hide anything that does, so leave them out of it.
// Haze silhouettes are lit by their own emissive colour and must not bloom either.
for (const m of scene.meshes) if (m.material?.name.startsWith("card:") || m.name === "skyDome" || m.name.endsWith("Haze")) glowLayer.addExcludedMesh(m as Mesh);
const detail = scene.meshes.filter((m) => m.name === "ferns" || m.name === "giantLeaves" || m.material?.name === "card:foliage");
const quality = new QualityController(engine, shadows, glowLayer, detail);

// --- Settings --------------------------------------------------------------------

const settings = loadSettings();
const sound = new Soundscape(() => scannables, volumesOf());

function volumesOf() {
  return { master: settings.volume, ambience: settings.ambience, effects: settings.effects, music: settings.music };
}

// Browsers only start audio after a click or key press.
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => sound.start());
hud.onSound = (kind, text) => {
  if (kind === "toast") sound.toast(text);
  if (kind === "shutter") sound.play(sfx.shutter, undefined, "effects", 1, 0.3);
  if (kind === "notice" && /^(Nothing to scan|No biological|Too far|Not enough energy)/.test(text)) sound.play(sfx.denied, undefined, "effects", 1, 0);
};
let lastTarget: unknown;

function applySettings(): void {
  rig.lookSpeed = settings.lookSpeed;
  rig.invertLook = settings.invertLook;
  rig.camera.fov = (settings.fov * Math.PI) / 180;
  quality.setFixed(settings.quality === "auto" ? undefined : settings.quality);
  document.documentElement.style.setProperty("--ui-scale", String(settings.textSize / 100));
  document.body.classList.toggle("reduce-motion", settings.reducedMotion);
  document.body.classList.toggle("hide-fps", !settings.showFps);
  hud.reducedMotion = settings.reducedMotion;
  sound.setVolumes(volumesOf());
  if (settings.sprint === "hold") sprintLatched = false;
}

/** Sprint state when the settings make Shift a toggle. */
let sprintLatched = false;
let menuMode: "start" | "continue" | "paused" = "start";
const settingsView = new SettingsView(startMenu, settings, applySettings, () => {
  startScreen.classList.remove("show-settings");
  renderMenu(menuMode);
});
applySettings();

let state: State = "start";
const logbookView = new LogbookView(logbook, time, () => regions.active, closeLogbook);
logbook.onChange(() => hud.setUnread(logbook.unread.size));
const connectedRelay = () => relays.find((r) => r.activated && r.inRange(robot.position));
const upgradesView = new UpgradesView(upgrades, logbook, () => !!connectedRelay(), installUpgrade, () => { const relay = connectedRelay(); if (relay) useRelay(relay); }, closePanel);
const mapView = new MapView(upgrades, logbook, robot, relays, save, closePanel);

function installUpgrade(id: UpgradeId): void {
  if (!upgrades.install(id, !!connectedRelay())) return;
  status.configure(upgrades.has("battery"), upgrades.has("durability"), upgrades.has("solar"));
  hud.notice("Upgrade installed."); save();
}
function openPanel(panel: "upgrades" | "map"): void {
  if (panel === "map" && !upgrades.has("map")) { hud.notice("Install the mapping subsystem at a relay after uploading 5% research."); return; }
  state = panel; (panel === "map" ? mapView : upgradesView).open(); input.releaseLock(); startScreen.classList.add("hidden");
}
function closePanel(): void {
  upgradesView.hide(); mapView.hide(); state = "paused"; renderMenu("paused"); input.requestLock();
}

// --- Save / load -------------------------------------------------------------

if (saved) {
  logbook.load(saved.logbook);
  for (const r of relays) r.setActivated(saved.relays ? saved.relays.includes(r.id) : r.id === "street" && saved.relayActivated);
  homeRelay = relays.find((r) => r.id === saved.homeRelay && r.activated) ?? relays[0];
  time.day = saved.day;
  time.hours = saved.hours;
  // Continue where the robot last saved.
  robot.teleport(homeRelay.spawn, homeRelay.spawnYaw);
  rig.yaw = homeRelay.spawnYaw;
  updateRegion();
}
const playtest = new Playtest(logbook, !saved);
renderMenu(saved ? "continue" : "start");

/** Title / pause menu. "New game" clears the local save. */
function renderMenu(mode: "start" | "continue" | "paused"): void {
  menuMode = mode;
  startScreen.classList.remove("show-settings");
  startScreen.dataset.mode = mode;
  (document.getElementById("start-controls") as HTMLDetailsElement).open = false;
  const first = mode === "start" ? "New game" : mode === "paused" ? "Resume" : "Continue";
  startMenu.innerHTML =
    `<button class="kn-menu-item" data-action="play" aria-current="true">${icon(mode === "start" ? "play" : "ring")}${first}</button>` +
    (mode === "start" ? "" : `<button class="kn-menu-item" data-action="new">${icon("play")}New game</button>`) +
    `<button class="kn-menu-item" data-action="logbook">${icon("book")}Logbook</button>` +
    `<button class="kn-menu-item" data-action="settings">${icon("sliders")}Settings</button>` +
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
  if (action === "logbook") openLogbook();
  if (action === "settings") {
    startScreen.classList.add("show-settings");
    settingsView.render();
  }
  if (action === "report") void copyReport((e.target as HTMLElement).closest<HTMLElement>("[data-action]")!);
  if (action === "new") {
    clearSave();
    location.reload();
  }
});

// Keep the reference's selection treatment aligned with pointer and keyboard focus.
startMenu.addEventListener("focusin", (e) => selectMenuItem(e.target));
startMenu.addEventListener("pointerover", (e) => selectMenuItem(e.target));
function selectMenuItem(target: EventTarget | null): void {
  const item = (target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-action]");
  if (!item) return;
  for (const button of startMenu.querySelectorAll("button[data-action]")) button.setAttribute("aria-current", String(button === item));
}
startMenu.addEventListener("keydown", (e) => {
  if (startScreen.classList.contains("show-settings") || !["ArrowDown", "ArrowUp"].includes(e.code)) return;
  const items = [...startMenu.querySelectorAll<HTMLButtonElement>("button[data-action]")];
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  e.preventDefault(); items[(i + (e.code === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
});

let lastSave = performance.now();

function save(): void {
  lastSave = performance.now();
  writeSave({
    version: 1,
    logbook: logbook.toJSON(),
    upgrades: upgrades.toJSON(),
    relayActivated: relays[0].activated,
    relays: relays.filter((r) => r.activated).map((r) => r.id),
    homeRelay: homeRelay.id,
    day: time.day,
    hours: time.hours,
  });
}

// --- Onboarding hints (only for a new game) -----------------------------------

const tutorial = { active: !saved, elapsed: 0, boot: 0, lensOpened: false, scanned: false, logbookOpened: false, doneAt: 0 };

/** First activation: a few lines from the robot's own systems before the control hints. */
const BOOT_LINES: [number, string][] = [
  [0.5, "Survey unit online."],
  [4, "Memory: empty. Origin: unknown."],
  [7.5, "Directive: find life. Observe it. Record everything."],
];

function updateTutorial(dt: number): void {
  if (!tutorial.active) return;
  tutorial.elapsed += dt;
  if (tutorial.boot < BOOT_LINES.length && tutorial.elapsed >= BOOT_LINES[tutorial.boot][0]) {
    hud.caption(BOOT_LINES[tutorial.boot][1], 3.2);
    tutorial.boot++;
  }
  if (!tutorial.lensOpened) {
    hud.hint(tutorial.elapsed < 11 ? "<b>WASD</b> move · <b>Mouse</b> look around" : "<b>Right click</b> to open the scanner lens");
  } else if (!tutorial.scanned) {
    hud.hint("Aim at something and <b>left click</b> to scan · <b>← →</b> change scan mode");
  } else if (!tutorial.logbookOpened) {
    hud.hint("A new page is in your Logbook · <b>Tab</b> opens it");
  } else {
    tutorial.doneAt ||= tutorial.elapsed;
    hud.hint("Each page says what to observe next · <b>E</b> at a relay saves, recharges and uploads");
    if (tutorial.elapsed - tutorial.doneAt > 20) { hud.hint(undefined); tutorial.active = false; }
  }
}

// --- State changes -----------------------------------------------------------

canvas.addEventListener("click", () => {
  if (!input.locked && !["logbook", "upgrades", "map"].includes(state)) input.requestLock();
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
  startScreen.classList.toggle("hidden", input.locked || ["logbook", "upgrades", "map"].includes(state));
});

let logbookReturn: State = "playing";
function openLogbook(): void {
  logbookReturn = state;
  state = "logbook";
  tutorial.logbookOpened = true;
  playtest.logbookOpened();
  logbookView.open();
  input.releaseLock();
  startScreen.classList.add("hidden");
}

function closeLogbook(): void {
  logbookView.close();
  hud.setUnread(logbook.unread.size);
  if (logbookReturn === "start" || logbookReturn === "paused") {
    state = logbookReturn; renderMenu(state === "paused" ? "paused" : readSave() ? "continue" : "start");
    startScreen.classList.remove("hidden");
    startMenu.querySelector<HTMLButtonElement>('[data-action="logbook"]')?.focus();
  } else {
    state = "paused"; renderMenu("paused"); startScreen.classList.remove("hidden"); input.requestLock();
  }
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

function useRelay(relay: RelayStation): void {
  const first = !relay.activated;
  relay.setActivated(true);
  homeRelay = relay;
  const received = upgrades.upload();
  if (received.length) {
    hud.caption(TRANSMISSIONS[received[received.length - 1] / 5 - 1], 10);
    sound.play(sfx.transmission, undefined, "effects", 3, 0.3);
  }
  status.restore();
  hud.setHealth(status.health, status.maxHealth);
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
    robot.teleport(homeRelay.spawn, homeRelay.spawnYaw);
    rig.yaw = homeRelay.spawnYaw;
    updateRegion();
    status.restore();
    hud.setHealth(status.health, status.maxHealth);
    hud.toast("Unit disabled", "Restored at Relay Station", { kind: "system", field: "Your discoveries are safe." });
  });
}

// --- Frame loop --------------------------------------------------------------

let fpsTimer = 0;
let underground = 0;
let autosaveTimer = 30;

scene.onBeforeRenderObservable.add(() => {
  const real = engine.getDeltaTime() / 1000;
  titleBackdrops.update(real, state === "start" && !settings.reducedMotion);
  if (state === "playing") {
    quality.update(real);
    playtest.sampleFrame(real, quality.label);
  }
  frame(Math.min(real, 0.05));
});

function frame(dt: number): void {
  hud.update(dt);

  if (state === "upgrades" || state === "map") {
    if (input.wasPressed("Escape") || input.wasPressed(state === "map" ? "KeyM" : "KeyU")) closePanel();
  } else if (state === "logbook") {
    if (input.wasPressed("Tab") || input.wasPressed("Escape")) closeLogbook();
  } else if (state === "playing") {
    updateGame(dt);
  }
  input.endFrame();
  // Underground, the light fades in over the first few metres down the stairs.
  underground += (undergroundAt(robot.position) - underground) * Math.min(1, dt * 2);
  atmosphere.apply(time, scanner.lensOn && scanner.mode === "night", Math.round(underground * 50) / 50);
  // Deep underground the sun is all but cut, so its shadow map can stop updating (saves a pass of draws).
  // (Only set on change: setting the rate resets the map's counter, which renders it again.)
  const shadowMap = shadows.getShadowMap();
  const shadowRate = underground > 0.97 ? 0 : 1;
  if (shadowMap && shadowMap.refreshRate !== shadowRate) shadowMap.refreshRate = shadowRate;

  fpsTimer -= dt;
  if (fpsTimer <= 0) {
    fpsTimer = 0.5;
    hud.setFps(`${engine.getFps().toFixed(0)} FPS · ${quality.label} · ${rig.mode === "first" ? "1st" : "3rd"} person`);
  }
}

function updateGame(dt: number): void {
  playtest.update(dt);
  upgrades.explore(robot.position.x, robot.position.z);
  if (input.wasPressed("KeyU")) { openPanel("upgrades"); return; }
  if (input.wasPressed("KeyM")) { openPanel("map"); return; }
  if (input.wasPressed("KeyG") && upgrades.has("grapple")) {
    if (status.energy >= 10 && robot.beginGrapple(rig.camera.getForwardRay(35))) status.trySpend(10);
    else hud.notice("Aim at an exposed ledge within 35 metres. Grappling needs 10 energy.");
  }
  if (input.wasPressed("KeyV")) rig.toggleMode();
  if (input.wasPressed("Tab")) {
    openLogbook();
    return;
  }
  if (input.wasPressed("Mouse2")) {
    scanner.toggleLens();
    sound.play(scanner.lensOn ? sfx.lensOn : sfx.lensOff, undefined, "effects", 1, 0);
    tutorial.lensOpened ||= scanner.lensOn;
  }
  if (input.wasPressed("ArrowLeft") || input.wasPressed("ArrowRight")) {
    scanner.cycleMode(input.wasPressed("ArrowLeft") ? -1 : 1);
    if (scanner.lensOn) sound.play(sfx.modeTick, undefined, "effects", 1, 0);
  }
  if (input.wasPressed("Mouse0") && scanner.lensOn) {
    scanner.scan();
    playtest.scanned();
    tutorial.scanned ||= logbook.completion() > 0;
  }

  time.update(dt);
  wind.update(dt);

  const wading = regions.active === "arcade" && waterAt(robot.position) === "wade";
  if (settings.sprint === "toggle" && (input.wasPressed("ShiftLeft") || input.wasPressed("ShiftRight"))) sprintLatched = !sprintLatched;
  const moved = robot.update(dt, input, rig.yaw, rig.mode === "first", {
    sprint: settings.sprint === "toggle" ? sprintLatched : undefined,
    canSprint: upgrades.has("sprint"),
    canClimb: upgrades.has("climb"),
    canHover: upgrades.has("hover"),
    canGlide: upgrades.has("glide"),
    spendEnergy: (amount) => status.trySpend(amount),
    depleted: status.depleted,
    speedScale: wading ? WADE_SPEED : 1,
  });
  ctx.robotSpeed = moved / dt;
  status.update(dt, moved, robot.isSprinting, time.daylight);
  if (wading) status.energy = Math.max(0, status.energy - moved * WADE_COST_PER_METRE);
  rig.update(dt, input);
  for (const l of life) l.update(dt);
  scanner.update(dt);

  updateRegion();
  updateSpores(dt);

  if (scanner.targeted !== lastTarget) {
    lastTarget = scanner.targeted;
    if (lastTarget) sound.play(sfx.targetTick, undefined, "effects", 1, 0);
  }
  const forward = rig.camera.getForwardRay(1).direction;
  sound.update(dt, {
    region: regions.active,
    listener: rig.camera.position,
    forward,
    robot: robot.position,
    speed: ctx.robotSpeed,
    grounded: robot.isGrounded,
    wading,
    airborneMotor: robot.isHovering || robot.isGliding || robot.isGrappling,
    daylight: time.daylight,
    wind: wind.strength,
    energy: status.energy / status.capacity,
  });

  // Relay Station interaction.
  const relay = relays.find((r) => r.inRange(robot.position));
  if (relay) {
    const restUntil = time.isNight || time.hours >= 17 ? "morning" : "nightfall";
    const minutes = Math.round((performance.now() - lastSave) / 60000);
    hud.console(
      "Relay Station",
      relay.activated
        ? [
            { key: "E", icon: "save", label: "Save and recharge", sub: `Last save: ${minutes < 1 ? "just now" : `${minutes} min ago`} · energy ${Math.round((status.energy / status.capacity) * 100)}%`, primary: true },
            { key: "R", icon: restUntil === "morning" ? "sun" : "moon", label: `Rest until ${restUntil}`, sub: "Time passes while the unit recharges" },
            { key: "U", icon: "zap", label: "Upload and upgrade", sub: `${Math.floor(upgrades.uploaded)}% research uploaded` },
            { key: "Tab", icon: "book", label: "Open Logbook", sub: `${Math.round(logbook.completion() * 100)}% complete` },
          ]
        : [{ key: "E", icon: "zap", label: "Activate", sub: "Sets your respawn point and saves", primary: true }],
    );
    if (input.wasPressed("KeyE")) useRelay(relay);
    if (input.wasPressed("KeyR") && relay.activated) restAtRelay();
  } else {
    hud.console(undefined);
  }

  if (status.disabled) respawn();

  hud.setEnergy(status.energy, status.capacity);
  hud.setHealth(status.health, status.maxHealth);
  const nearest = relays.reduce((a, b) => (Vector3.Distance(a.position, robot.position) <= Vector3.Distance(b.position, robot.position) ? a : b));
  const toRelay = nearest.position.subtract(robot.position);
  hud.setCompass(rig.yaw, robot.position.y, Math.atan2(toRelay.x, toRelay.z), Math.hypot(toRelay.x, toRelay.z));
  if (status.depleted) hud.notice("Energy depleted. Recharge in sunlight or at the Relay Station.");

  updateTutorial(dt);
  autosaveTimer -= dt;
  if (autosaveTimer <= 0) {
    autosaveTimer = 30;
    save();
  }
}

/** Shows the block the robot is in; swaps happen inside the covered passages. */
function updateRegion(): void {
  const p = robot.position;
  const active = regions.active;
  const want =
    p.x > 384
      ? stationRegionAt(p, active === "station" ? "station" : "arcade")
      : p.x > PASSAGE.path.x0 - 20
        ? passageRegionAt(p, active === "street" || active === "station" ? "temple" : active)
        : laneRegionAt(p, active === "arcade" || active === "station" ? "temple" : active);
  if (want) regions.activate(want);
}

let sporeHaze = 0;

function updateSpores(dt: number): void {
  ctx.sensorsJammed = Math.max(0, ctx.sensorsJammed - dt);
  // Thick at first, clearing over the last few seconds.
  const target = ctx.sensorsJammed > 0 ? Math.min(0.85, 0.25 + ctx.sensorsJammed / SPORE_SECONDS) : 0;
  sporeHaze += (target - sporeHaze) * Math.min(1, dt * (target > sporeHaze ? 6 : 1.5));
  hud.setSpores(sporeHaze);
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
settings, applySettings, settingsView, sound, robot, rig, scene, input, titleBackdrops, time, wind, status, logbook, logbookView, openLogbook, closeLogbook, scanner, upgrades, upgradesView, mapView, useRelay, installUpgrade, openPanel, save, relay: relays[0], relays, regions, temple, arcade, station, hud, life, scannables, ctx, playtest, quality,
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
