import {
  Color3,
  Color4,
  ColorCurves,
  DirectionalLight,
  HemisphericLight,
  ImageProcessingConfiguration,
  Scene,
  StandardMaterial,
  Vector3,
} from "../babylon";
import type { DayCycle } from "../game/dayCycle";
import type { Sky } from "./sky";

/**
 * Time-of-day look: sun and sky light, fog, sky colours and the final colour grade.
 * Each key is a mood from the art direction (misty dawn, clear day, golden
 * afternoon, blue night); the hours in between blend smoothly.
 */
interface Mood {
  hour: number;
  sun: Color3;
  sunIntensity: number;
  sky: Color3;
  skyIntensity: number;
  bounce: Color3;
  zenith: Color3;
  horizon: Color3;
  fog: Color3;
  fogDensity: number;
  exposure: number;
}

const hex = Color3.FromHexString;

const MOODS: Mood[] = [
  { hour: 0, sun: hex("#7d93c8"), sunIntensity: 0.42, sky: hex("#4a64a8"), skyIntensity: 0.7, bounce: hex("#1c2230"), zenith: hex("#050a16"), horizon: hex("#16223a"), fog: hex("#121b2e"), fogDensity: 0.02, exposure: 1.62 },
  { hour: 5, sun: hex("#7d93c8"), sunIntensity: 0.36, sky: hex("#45557e"), skyIntensity: 0.56, bounce: hex("#1c2230"), zenith: hex("#0b1226"), horizon: hex("#2b2f48"), fog: hex("#1d2236"), fogDensity: 0.022, exposure: 1.62 },
  // Dawn: pink-orange horizon, thick low mist.
  { hour: 6.5, sun: hex("#ff9a5c"), sunIntensity: 1.32, sky: hex("#8d8fae"), skyIntensity: 0.79, bounce: hex("#3a3029"), zenith: hex("#3d5577"), horizon: hex("#eeb08a"), fog: hex("#c4a596"), fogDensity: 0.026, exposure: 1.43 },
  // Morning: clear and fresh, mist lifting.
  { hour: 9, sun: hex("#ffe2b8"), sunIntensity: 2.1, sky: hex("#a9bdd0"), skyIntensity: 0.96, bounce: hex("#4a4634"), zenith: hex("#3f72a6"), horizon: hex("#d3dcd6"), fog: hex("#b8c7c6"), fogDensity: 0.014, exposure: 1.37 },
  // Midday: brightest, least haze.
  { hour: 13, sun: hex("#fff3dc"), sunIntensity: 2.4, sky: hex("#b4c6d6"), skyIntensity: 1.05, bounce: hex("#4f4c3a"), zenith: hex("#3a6fa6"), horizon: hex("#d8e0dc"), fog: hex("#c2ccc8"), fogDensity: 0.011, exposure: 1.3 },
  // Golden afternoon, as on the environment reference sheet.
  { hour: 16.5, sun: hex("#ffc27a"), sunIntensity: 2.4, sky: hex("#a8b2c4"), skyIntensity: 0.88, bounce: hex("#5a4a34"), zenith: hex("#46689a"), horizon: hex("#f1cc98"), fog: hex("#d4bd98"), fogDensity: 0.015, exposure: 1.37 },
  { hour: 18.6, sun: hex("#ff7a40"), sunIntensity: 1.44, sky: hex("#8c86a6"), skyIntensity: 0.73, bounce: hex("#4a3426"), zenith: hex("#2f4068"), horizon: hex("#e68a5e"), fog: hex("#a4807a"), fogDensity: 0.017, exposure: 1.43 },
  // Dusk: violet and blue, the bioluminescence starts to read.
  { hour: 19.8, sun: hex("#8a7fc0"), sunIntensity: 0.36, sky: hex("#4a4f80"), skyIntensity: 0.61, bounce: hex("#221f2c"), zenith: hex("#141d38"), horizon: hex("#4c3f5e"), fog: hex("#2c2b42"), fogDensity: 0.019, exposure: 1.56 },
  { hour: 21, sun: hex("#7d93c8"), sunIntensity: 0.42, sky: hex("#4a64a8"), skyIntensity: 0.7, bounce: hex("#1c2230"), zenith: hex("#050a16"), horizon: hex("#16223a"), fog: hex("#121b2e"), fogDensity: 0.02, exposure: 1.62 },
];

/** Where the moonlight comes from at night (direction the light travels). */
const MOON_DIRECTION = new Vector3(0.35, -1, -0.45).normalize();

export class Atmosphere {
  private readonly water: StandardMaterial | null;

  constructor(
    private readonly scene: Scene,
    private readonly sun: DirectionalLight,
    private readonly ambient: HemisphericLight,
    private readonly sky: Sky,
  ) {
    this.water = scene.getMaterialByName("water") as StandardMaterial | null;
    scene.fogMode = Scene.FOGMODE_EXP2;
    // Colour grade applied inside every material: filmic tone curve, a little
    // extra contrast, cool shadows, warm highlights and a soft vignette.
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.contrast = 1.18;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.2;
    ip.vignetteStretch = 0.4;
    ip.vignetteColor = new Color4(0.02, 0.03, 0.04, 0);
    ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    const curves = new ColorCurves();
    curves.shadowsHue = 210;
    curves.shadowsDensity = 30;
    curves.shadowsSaturation = 10;
    curves.highlightsHue = 35;
    curves.highlightsDensity = 25;
    curves.globalSaturation = 0;
    ip.colorCurves = curves;
    ip.colorCurvesEnabled = true;
  }

  apply(time: DayCycle, nightVision = false): void {
    const m = moodAt(time.hours);
    const day = time.daylight;
    // The sun drives shadows by day, the moon by night; swap while both are faint.
    this.sun.direction = day > 0.05 ? time.sunDirection : MOON_DIRECTION;
    this.sun.diffuse = m.sun;
    this.sun.specular = m.sun;
    this.sun.intensity = m.sunIntensity;
    this.ambient.diffuse = m.sky;
    this.ambient.groundColor = m.bounce;
    this.ambient.intensity = m.skyIntensity * (nightVision ? 2.2 : 1);
    this.scene.fogColor = m.fog;
    this.scene.fogDensity = m.fogDensity;
    this.scene.clearColor = new Color4(m.horizon.r, m.horizon.g, m.horizon.b, 1);
    this.scene.ambientColor = m.bounce;
    this.scene.imageProcessingConfiguration.exposure = m.exposure * (nightVision ? 1.8 : 1);
    const toSun = this.sun.direction.scale(-1);
    const glow = day > 0.05 ? m.sun.scale(0.9) : m.sun.scale(0.12);
    // Puddles mirror the sky's colour.
    if (this.water) this.water.emissiveColor = Color3.Lerp(m.horizon, m.zenith, 0.4).scale(0.1);
    this.sky.set(m.zenith, m.horizon, glow, toSun, Math.max(0, 1 - day * 4));
  }
}

function moodAt(hours: number): Mood {
  let i = MOODS.length - 1;
  while (i > 0 && MOODS[i].hour > hours) i--;
  const a = MOODS[i];
  const b = MOODS[(i + 1) % MOODS.length];
  const span = (b.hour > a.hour ? b.hour : b.hour + 24) - a.hour;
  const t = smooth(Math.min(1, Math.max(0, (hours - a.hour) / span)));
  const c = (x: Color3, y: Color3) => Color3.Lerp(x, y, t);
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    hour: hours,
    sun: c(a.sun, b.sun),
    sunIntensity: n(a.sunIntensity, b.sunIntensity),
    sky: c(a.sky, b.sky),
    skyIntensity: n(a.skyIntensity, b.skyIntensity),
    bounce: c(a.bounce, b.bounce),
    zenith: c(a.zenith, b.zenith),
    horizon: c(a.horizon, b.horizon),
    fog: c(a.fog, b.fog),
    fogDensity: n(a.fogDensity, b.fogDensity),
    exposure: n(a.exposure, b.exposure),
  };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
