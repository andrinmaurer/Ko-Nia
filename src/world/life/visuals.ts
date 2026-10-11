import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "../../babylon";
import { rng } from "../textures";
import { mat } from "./materials";

type Point = [number, number, number];

export type Grain =
  | "fur" | "shell" | "leaf" | "ceramic"
  | "feather" | "plates" | "stone" | "bronze" | "lacquer" | "rusted" | "bark" | "scales" | "moss";

type Ctx = CanvasRenderingContext2D;

const rgba = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const shade = (hex: string, k: number, a = 1) => {
  const c = Color3.FromHexString(hex);
  return rgba(Math.min(255, c.r * 255 * k), Math.min(255, c.g * 255 * k), Math.min(255, c.b * 255 * k), a);
};

/** Paint helpers for the reference-matched surfaces. Every pattern tiles loosely; relief is baked into colour. */
const GRAINS: Partial<Record<Grain, (c: Ctx, s: number, r: () => number, colour: string) => void>> = {
  // Overlapping scalloped feathers with a warm iridescent edge (Hookbill sheet).
  feather(c, s, r, colour) {
    for (let y = -8; y < s + 8; y += 9) for (let x = -8 + ((y / 9) % 2) * 6; x < s + 8; x += 12) {
      c.fillStyle = shade(colour, 0.75 + r() * 0.5);
      c.beginPath(); c.ellipse(x, y, 7, 10, 0, 0, Math.PI); c.fill();
      c.strokeStyle = r() > 0.45 ? rgba(150, 92, 46, 0.55) : rgba(70, 92, 96, 0.4);
      c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y, 7, 10, 0, 0.15, Math.PI - 0.15); c.stroke();
      c.strokeStyle = rgba(0, 0, 0, 0.35); c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 9); c.stroke();
    }
  },
  // Keratin shingles with pale rims and dark gaps (Drainback sheet).
  plates(c, s, r, colour) {
    for (let y = 0; y < s + 12; y += 12) for (let x = ((y / 12) % 2) * 9; x < s + 12; x += 18) {
      c.fillStyle = shade(colour, 0.7 + r() * 0.55);
      c.beginPath(); c.moveTo(x - 9, y - 4); c.quadraticCurveTo(x, y + 16, x + 9, y - 4); c.closePath(); c.fill();
      c.strokeStyle = rgba(214, 190, 140, 0.35); c.lineWidth = 1.2; c.stroke();
      c.fillStyle = rgba(20, 16, 10, 0.45); c.fillRect(x - 9, y - 5, 18, 1.5);
      if (r() > 0.75) { c.fillStyle = rgba(86, 104, 52, 0.5); c.beginPath(); c.arc(x + (r() - 0.5) * 8, y + 2, 2.5, 0, 7); c.fill(); }
    }
  },
  // Weathered granite with lichen rosettes and moss gathered in hollows (Guardian Statue, stone lantern).
  stone(c, s, r, colour) {
    for (let i = 0; i < 1400; i++) { c.fillStyle = shade(colour, 0.7 + r() * 0.55, 0.5); c.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3); }
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, rad = 3 + r() * 9;
      c.fillStyle = r() > 0.5 ? rgba(176, 172, 132, 0.45) : rgba(196, 190, 170, 0.35);
      c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
    }
    for (let i = 0; i < 18; i++) {
      const x = r() * s, y = r() * s;
      for (let k = 0; k < 40; k++) {
        const g = r();
        c.fillStyle = rgba(58 + g * 40, 82 + g * 46, 28 + g * 14, 0.7);
        c.beginPath(); c.arc(x + (r() - 0.5) * 22, y + (r() - 0.3) * 12, 1 + r() * 3, 0, 7); c.fill();
      }
    }
    c.strokeStyle = rgba(30, 30, 26, 0.5); c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { let x = r() * s, y = r() * s; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 20; y += r() * 14; c.lineTo(x, y); } c.stroke(); }
  },
  // Cast bronze gone to verdigris, darker in the recesses (Temple Bell, Origin Mark).
  bronze(c, s, r, colour) {
    for (let i = 0; i < 1600; i++) { c.fillStyle = shade(colour, 0.65 + r() * 0.6, 0.5); c.fillRect(r() * s, r() * s, 2, 2); }
    for (let i = 0; i < 60; i++) {
      c.fillStyle = r() > 0.4 ? rgba(92, 150, 128, 0.35 + r() * 0.3) : rgba(120, 84, 44, 0.4);
      c.beginPath(); c.ellipse(r() * s, r() * s, 3 + r() * 12, 2 + r() * 6, r() * 3, 0, 7); c.fill();
    }
    for (let i = 0; i < 20; i++) { c.fillStyle = rgba(104, 160, 136, 0.45); c.fillRect(r() * s, r() * s, 1.5, 6 + r() * 18); }
  },
  // Vermilion lacquer worn through to grey timber, with dark water streaks and moss (Red Gate sheet).
  lacquer(c, s, r, colour) {
    for (let y = 0; y < s; y += 2) { c.fillStyle = shade(colour, 0.82 + r() * 0.3); c.fillRect(0, y, s, 2); }
    for (let i = 0; i < 70; i++) {
      c.fillStyle = r() > 0.5 ? rgba(110, 96, 82, 0.85) : rgba(70, 58, 46, 0.8);
      c.beginPath(); c.ellipse(r() * s, r() * s, 1 + r() * 7, 2 + r() * 14, 0, 0, 7); c.fill();
    }
    for (let i = 0; i < 26; i++) { c.fillStyle = rgba(36, 26, 20, 0.22); c.fillRect(r() * s, r() * s * 0.4, 1 + r() * 3, 30 + r() * 80); }
    for (let i = 0; i < 12; i++) {
      const x = r() * s, y = s * (0.6 + r() * 0.4);
      for (let k = 0; k < 30; k++) { const g = r(); c.fillStyle = rgba(70 + g * 40, 96 + g * 40, 34, 0.75); c.beginPath(); c.arc(x + (r() - 0.5) * 18, y + (r() - 0.5) * 8, 1 + r() * 2.5, 0, 7); c.fill(); }
    }
  },
  // Painted sheet metal blistered by rust, with drips below each patch (Vending Machine sheet).
  rusted(c, s, r, colour) {
    for (let i = 0; i < 900; i++) { c.fillStyle = shade(colour, 0.8 + r() * 0.35, 0.6); c.fillRect(r() * s, r() * s, 3, 3); }
    for (let i = 0; i < 34; i++) {
      const x = r() * s, y = r() * s, rad = 3 + r() * 14;
      c.fillStyle = rgba(96 + r() * 34, 54 + r() * 18, 30, 0.8);
      c.beginPath(); c.ellipse(x, y, rad, rad * (0.5 + r()), r() * 3, 0, 7); c.fill();
      c.fillStyle = rgba(96, 48, 24, 0.35); c.fillRect(x - 1, y, 2 + r() * 2, 10 + r() * 30);
    }
    for (let i = 0; i < 200; i++) { c.fillStyle = rgba(60, 34, 20, 0.5); c.fillRect(r() * s, r() * s, 1, 1); }
    for (let i = 0; i < 30; i++) { c.fillStyle = rgba(40, 36, 28, 0.12); c.fillRect(r() * s, 0, 4 + r() * 10, s); }
  },
  // Furrowed reddish bark (cedar, wisteria stems).
  bark(c, s, r, colour) {
    c.fillStyle = shade(colour, 0.6); c.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = r() * s; c.strokeStyle = shade(colour, 0.8 + r() * 0.6, 0.9); c.lineWidth = 2 + r() * 4;
      c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (r() - 0.5) * 12, s / 3, x + (r() - 0.5) * 12, s * 2 / 3, x + (r() - 0.5) * 8, s); c.stroke();
    }
  },
  // Fine overlapping fish or reptile scales with a lighter rim.
  scales(c, s, r, colour) {
    for (let y = 0; y < s + 6; y += 6) for (let x = ((y / 6) % 2) * 4; x < s + 8; x += 8) {
      c.fillStyle = shade(colour, 0.8 + r() * 0.4);
      c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI); c.fill();
      c.strokeStyle = shade(colour, 1.35, 0.6); c.lineWidth = 0.8; c.beginPath(); c.arc(x, y, 4.5, 0.2, Math.PI - 0.2); c.stroke();
    }
  },
  // Cushion moss: dense dots in two greens with yellow tips.
  moss(c, s, r, colour) {
    for (let i = 0; i < 2600; i++) {
      const g = r();
      c.fillStyle = g > 0.85 ? rgba(170, 176, 80, 0.8) : shade(colour, 0.6 + g * 0.8, 0.85);
      c.beginPath(); c.arc(r() * s, r() * s, 0.8 + r() * 1.8, 0, 7); c.fill();
    }
  },
};

/** Small shared painted surfaces. Relief is baked into colour, never a normal-map pass. */
export function organic(scene: Scene, name: string, colour: string, grain: Grain = "shell"): StandardMaterial {
  const key = `organism:${name}`;
  const previous = scene.getMaterialByName(key);
  if (previous instanceof StandardMaterial) return previous;
  const base = Color3.FromHexString(colour);
  const material = mat(scene, key, 1, 1, 1, grain === "ceramic" ? 0.18 : 0.06);
  const painter = GRAINS[grain];
  const size = painter ? 256 : 128;
  const texture = new DynamicTexture(key, size, scene, true);
  const c = texture.getContext() as unknown as CanvasRenderingContext2D;
  c.fillStyle = colour;
  c.fillRect(0, 0, size, size);
  const random = rng([...name].reduce((seed, ch) => seed * 31 + ch.charCodeAt(0), 0));
  if (painter) painter(c, size, random, colour);
  else {
    for (let i = 0; i < 480; i++) {
      const x = random() * 128, y = random() * 128;
      const light = random() > 0.55;
      c.strokeStyle = light ? "rgba(225,216,181,.12)" : "rgba(24,30,24,.18)";
      c.lineWidth = grain === "fur" ? 0.6 : 1;
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + (random() - 0.5) * 6, y + (grain === "fur" ? 9 : 2)); c.stroke();
    }
  }
  if (grain === "leaf") {
    c.strokeStyle = "rgba(204,202,129,.3)";
    for (let y = 8; y < 128; y += 14) {
      c.beginPath(); c.moveTo(64, y + 12); c.lineTo(5, y); c.moveTo(64, y + 12); c.lineTo(123, y); c.stroke();
    }
    c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 128); c.stroke();
  }
  if (grain === "ceramic") {
    c.strokeStyle = "rgba(48,43,34,.48)";
    c.beginPath(); c.moveTo(12, 20); c.lineTo(32, 36); c.lineTo(25, 60); c.lineTo(46, 88); c.stroke();
  }
  texture.update(false);
  material.diffuseTexture = texture;
  material.ambientColor = base.scale(0.15);
  return material;
}

/**
 * Alpha-tested painted cut-out (wings, leaves, petals). Named "card:" so the glow pass skips it,
 * like the other cut-out cards. `draw` paints onto a transparent canvas.
 */
export function cutout(scene: Scene, name: string, size: number, draw: (c: Ctx, s: number, r: () => number) => void): StandardMaterial {
  const key = `card:${name}`;
  const previous = scene.getMaterialByName(key);
  if (previous instanceof StandardMaterial) return previous;
  const material = new StandardMaterial(key, scene);
  const texture = new DynamicTexture(key, size, scene, true);
  const c = texture.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, size, size);
  draw(c, size, rng([...name].reduce((seed, ch) => seed * 31 + ch.charCodeAt(0), 0)));
  texture.update(true);
  texture.hasAlpha = true;
  material.diffuseTexture = texture;
  material.backFaceCulling = false;
  material.specularColor = Color3.Black();
  material.alphaCutOff = 0.4;
  return material;
}

/** Bake local details into one mesh per material, or one mesh per animated joint. */
export class Form {
  private readonly groups = new Map<StandardMaterial, Mesh[]>();
  constructor(private readonly scene: Scene, private readonly name: string) {}
  add(mesh: Mesh, material: StandardMaterial): Mesh {
    mesh.material = material;
    const group = this.groups.get(material) ?? [];
    group.push(mesh); this.groups.set(material, group);
    return mesh;
  }
  ellipsoid(position: Point, size: Point, material: StandardMaterial, segments = 8): Mesh {
    const m = MeshBuilder.CreateSphere(this.name, { diameter: 1, segments }, this.scene);
    m.position.set(...position); m.scaling.set(...size); return this.add(m, material);
  }
  box(position: Point, size: Point, material: StandardMaterial): Mesh {
    const m = MeshBuilder.CreateBox(this.name, { size: 1 }, this.scene);
    m.position.set(...position); m.scaling.set(...size); return this.add(m, material);
  }
  branch(points: Point[], radius: number, material: StandardMaterial): Mesh {
    return this.add(MeshBuilder.CreateTube(this.name, { path: points.map(p => new Vector3(...p)), radius, tessellation: 5, cap: Mesh.CAP_ALL }, this.scene), material);
  }
  /** Tube whose radius runs linearly from r0 at the first point to r1 at the last (beaks, limbs, stalks). */
  taper(points: Point[], r0: number, r1: number, material: StandardMaterial, tessellation = 6): Mesh {
    const path = points.map(p => new Vector3(...p));
    const n = Math.max(1, path.length - 1);
    return this.add(MeshBuilder.CreateTube(this.name, { path, radiusFunction: (i) => r0 + (r1 - r0) * (i / n), tessellation, cap: Mesh.CAP_ALL }, this.scene), material);
  }
  /** Surface of revolution around +y from [radius, height] pairs (bells, lanterns, pods, puffballs). */
  lathe(profile: [number, number][], position: Point, material: StandardMaterial, tessellation = 12): Mesh {
    const paths: Vector3[][] = [];
    for (let i = 0; i <= tessellation; i++) {
      const a = (i / tessellation) * Math.PI * 2;
      paths.push(profile.map(([rad, y]) => new Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad)));
    }
    const m = MeshBuilder.CreateRibbon(this.name, { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    m.position.set(...position); return this.add(m, material);
  }
  /** Flat double-sided quad, for alpha cut-outs merged into a form. */
  plane(position: Point, size: [number, number], rotation: Point, material: StandardMaterial): Mesh {
    const m = MeshBuilder.CreatePlane(this.name, { width: size[0], height: size[1], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    m.position.set(...position); m.rotation.set(...rotation); return this.add(m, material);
  }
  ring(position: Point, diameter: number, thickness: number, material: StandardMaterial): Mesh {
    const m = MeshBuilder.CreateTorus(this.name, { diameter, thickness, tessellation: 10 }, this.scene);
    m.position.set(...position); return this.add(m, material);
  }
  finish(parent?: TransformNode): Mesh[] {
    const result: Mesh[] = [];
    for (const [material, parts] of this.groups) {
      const mesh = Mesh.MergeMeshes(parts, true, true)!;
      mesh.name = `${this.name}:${material.name}`;
      mesh.material = material; mesh.parent = parent ?? null; mesh.receiveShadows = true;
      result.push(mesh);
    }
    return result;
  }
}

export function hookbillVisual(scene: Scene, node: TransformNode): { parts: Mesh[]; wings: Mesh[] } {
  // Glossy black plumage with copper iridescence, a long heavy hooked beak and dark scaly legs (Hookbill sheet).
  const feather = organic(scene, "hookbill-plumage", "#1b1f21", "feather");
  feather.specularColor = new Color3(0.26, 0.17, 0.09); feather.specularPower = 32;
  const copper = organic(scene, "hookbill-copper-plumage", "#3a2a1c", "feather");
  copper.specularColor = new Color3(0.36, 0.2, 0.08); copper.specularPower = 26;
  const horn = organic(scene, "hookbill-beak", "#2b2c2b");
  horn.specularColor = new Color3(0.25, 0.25, 0.25);
  const leg = organic(scene, "hookbill-legs", "#2e2a26", "scales");
  const eye = mat(scene, "hookbillEye", 0.24, 0.13, 0.04, 0.8);
  const f = new Form(scene, "hookbill-form");
  // Upright, deep-chested body tapering into a long tail.
  const body = f.ellipsoid([0, .37, -.06], [.3, .36, .6], feather, 10); body.rotation.x = -.68;
  f.ellipsoid([0, .44, .1], [.27, .32, .28], feather, 10);
  const neck = f.ellipsoid([0, .57, .17], [.17, .26, .18], feather); neck.rotation.x = .35;
  // Shaggy throat hackles.
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * .3;
    const h = f.ellipsoid([Math.sin(a) * .08, .5 + Math.abs(i - 3) * .012, .23 + Math.cos(a) * .03], [.055, .17, .025], i % 2 ? copper : feather, 4);
    h.rotation.set(.3, a, 0);
  }
  f.ellipsoid([0, .69, .24], [.17, .15, .23], feather);
  // Heavy curved beak: upper mandible hooks over a shorter lower one.
  f.taper([[0, .7, .32], [0, .7, .41], [0, .675, .5], [0, .63, .56], [0, .59, .555]], .05, .006, horn);
  f.taper([[0, .655, .33], [0, .645, .42], [0, .635, .48]], .03, .006, horn);
  for (const side of [-1, 1]) {
    f.ellipsoid([side * .075, .71, .3], [.03, .03, .03], eye);
    f.taper([[side * .07, .22, .02], [side * .075, .1, .05], [side * .075, .03, .06]], .03, .016, leg);
    // Three forward toes with claws and one opposing toe per foot.
    for (const o of [-1, 0, 1]) f.taper([[side * .075, .03, .06], [side * .075 + o * .045, .015, .14], [side * .075 + o * .055, .0, .17]], .012, .003, leg);
    f.taper([[side * .075, .03, .06], [side * .08, .015, -.02], [side * .085, 0, -.04]], .011, .003, leg);
  }
  // Long, slightly fanned tail.
  for (let i = -3; i <= 3; i++) {
    const tail = f.ellipsoid([i * .03, .2, -.5], [.07, .025, .42], i % 2 ? copper : feather, 6);
    tail.rotation.set(-.32, i * .06, 0);
  }
  const parts = f.finish(node), wings: Mesh[] = [];
  for (const side of [-1, 1]) {
    // Folded wing: overlapping coverts and long primaries that run back past the tail base.
    const wing = new Form(scene, "hookbill-wing");
    wing.ellipsoid([side * .02, 0, 0], [.07, .26, .34], feather, 8);
    for (let i = 0; i < 6; i++) {
      const p = wing.ellipsoid([side * (.03 + i * .006), -.06 - i * .022, -.14 - i * .05], [.05, .1, .42 - i * .025], i % 2 ? feather : copper, 6);
      p.rotation.x = -.42;
    }
    const meshes = wing.finish();
    // One material keeps a wing to a single draw call while retaining copper highlights.
    const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, true)!;
    merged.name = "hookbillWing"; merged.parent = node; merged.position.set(side * .15, .45, .04);
    wings.push(merged); parts.push(merged);
  }
  return { parts, wings };
}

export function drainbackVisual(scene: Scene, node: TransformNode): Mesh[] {
  // Rat descendant: brown fur, rows of overlapping keratin shingles down the back, pink ears and a long scaly tail.
  const fur = organic(scene, "drainback-fur-coat", "#6b5a48", "fur");
  const plates = organic(scene, "drainback-shingles", "#6e5a3e", "plates");
  plates.specularColor = new Color3(0.12, 0.1, 0.07);
  const pink = organic(scene, "drainback-skin", "#b98778");
  const tail = organic(scene, "drainback-tail", "#7a6253", "scales");
  const dark = mat(scene, "wildlifeEye", .025,.035,.025,.65);
  const tooth = mat(scene, "drainbackIncisor", .62,.5,.2,.3);
  const whisker = mat(scene, "whisker", .64,.58,.44);
  const f = new Form(scene, "drainback-form");
  // Hunched body, deeper at the haunches, with a soft pale belly.
  f.ellipsoid([0,.26,-.08], [.36,.34,.66], fur, 10);
  f.ellipsoid([0,.19,.02], [.27,.2,.5], organic(scene, "drainback-belly", "#8d7a66", "fur"));
  // Tapering head and snout.
  f.ellipsoid([0,.24,.3], [.22,.2,.26], fur);
  f.taper([[0,.23,.36],[0,.205,.47],[0,.18,.53]], .07, .025, fur);
  f.ellipsoid([0,.18,.54], [.045,.035,.03], pink);
  f.box([0,.145,.525], [.03,.04,.012], tooth);
  f.taper([[0,.14,-.38],[.04,.08,-.62],[.12,.04,-.86],[.22,.03,-1.02]], .045, .008, tail, 6);
  for (const side of [-1,1]) {
    f.ellipsoid([side*.085,.37,.24], [.1,.12,.035], pink);
    f.ellipsoid([side*.075,.29,.38], [.03,.03,.03], dark);
    for (const z of [-.25,.18]) {
      f.taper([[side*.13,.2,z],[side*.15,.1,z+.02],[side*.16,.03,z+.05]], .045, .024, fur);
      f.ellipsoid([side*.16,.02,z+.08], [.07,.035,.1], pink);
    }
    for (let i = 0; i < 4; i++) f.branch([[side*.03,.19,.5],[side*(.17+i*.025),.18+(i-1.5)*.03,.5+i*.01]], .002, whisker);
  }
  // Seven rows of shingles from shoulders to rump, overlapping like a pinecone.
  for (let row = 0; row < 7; row++) for (let col = -2; col <= 2; col++) {
    const z = .2 - row * .085, arch = Math.cos(col * .55);
    const p = f.ellipsoid([col*.075, .25 + .16*arch - Math.abs(row - 3) * .008, z], [.11,.035,.13], plates, 5);
    p.rotation.x = .35; p.rotation.z = -col*.45;
  }
  return f.finish(node);
}

export function mantisVisual(scene: Scene, body: TransformNode): { parts: Mesh[]; arms: Mesh[]; wings: Mesh[] } {
  // Grey-green, leaf-camouflaged mantis with mossy tufts: triangular head, long prothorax, spined raptorial forelegs.
  const shell = organic(scene, "mantis-hide", "#6c7656", "leaf");
  const joint = organic(scene, "mantis-limbs", "#55603f");
  const moss = organic(scene, "mantis-moss", "#5d7034", "moss");
  const wingMat = cutout(scene, "mantis-leafwing", 256, (c, s, r) => {
    // Leaf-shaped tegmen: grey-green with a midrib, side veins and lichen flecks.
    c.fillStyle = "#7d8462";
    c.beginPath(); c.moveTo(s / 2, 4); c.bezierCurveTo(s * .95, s * .25, s * .85, s * .8, s / 2, s - 4); c.bezierCurveTo(s * .15, s * .8, s * .05, s * .25, s / 2, 4); c.fill();
    c.strokeStyle = "rgba(60,64,40,.8)"; c.lineWidth = 2; c.beginPath(); c.moveTo(s / 2, 8); c.lineTo(s / 2, s - 8); c.stroke();
    c.lineWidth = 1;
    for (let y = 30; y < s - 20; y += 18) { c.beginPath(); c.moveTo(s / 2, y); c.lineTo(s * .2, y - 16); c.moveTo(s / 2, y); c.lineTo(s * .8, y - 16); c.stroke(); }
    for (let i = 0; i < 40; i++) { c.fillStyle = i % 3 ? "rgba(168,170,128,.45)" : "rgba(80,104,44,.6)"; c.beginPath(); c.arc(s * (.32 + r() * .36), s * (.1 + r() * .8), 2 + r() * 4, 0, 7); c.fill(); }
  });
  const eye = mat(scene, "mantisEyes", .42,.46,.26,.3);
  const f = new Form(scene, "mantis-form");
  // Segmented abdomen tapering to the tail, slightly raised.
  for (let i = 0; i < 6; i++) f.ellipsoid([0,.52 + i*.012,-.18 - i*.13], [.3 - i*.03,.22 - i*.018,.2], shell, 8);
  // Long prothorax rising to the head.
  f.taper([[0,.56,.0],[0,.72,.14],[0,.9,.26],[0,1.02,.32]], .075, .05, shell);
  const head = f.ellipsoid([0,1.05,.35], [.26,.14,.12], shell, 6);
  head.rotation.x = .2;
  f.taper([[0,1.02,.38],[0,.95,.42]], .04, .012, shell);
  for (let i = 0; i < 5; i++) f.ellipsoid([(i-2)*.05,.62 - Math.abs(i-2)*.02,-.3 - (i%2)*.2], [.08,.05,.1], moss, 5);
  for (const side of [-1,1]) {
    f.ellipsoid([side*.12,1.08,.36], [.085,.09,.075], eye);
    f.taper([[side*.04,1.12,.38],[side*.14,1.3,.46],[side*.26,1.44,.62],[side*.36,1.48,.8]], .007, .002, joint, 4);
    // Four long walking legs: femur up to a high knee, tibia down to the floor.
    for (const [z, spread] of [[-.12, .45], [-.32, .5]] as const) {
      const back = z < -.2;
      f.taper([[side*.1,.52,z],[side*spread*.8,.78,z+.04],[side*spread,.72,z+.06]], .026, .02, joint);
      f.taper([[side*spread,.72,z+.06],[side*(spread+.12),.36,z+(back?-.16:.18)],[side*(spread+.16),.02,z+(back?-.26:.3)]], .02, .01, joint);
    }
  }
  const parts = f.finish(body), arms: Mesh[] = [], wings: Mesh[] = [];
  for (const side of [-1,1]) {
    const a = new Form(scene, "mantis-foreleg");
    // Coxa, a thick spined femur folded back, and a tibia hooked under it.
    a.taper([[0,0,0],[side*.05,-.12,.08]], .035, .03, shell);
    a.taper([[side*.05,-.12,.08],[side*.07,-.02,.24],[side*.07,.06,.34]], .045, .025, shell);
    a.taper([[side*.07,.06,.34],[side*.07,-.12,.3],[side*.07,-.22,.2]], .025, .008, shell);
    for (let i = 0; i < 5; i++) a.taper([[side*.07,-.07+i*.03,.12+i*.05],[side*.07,-.12+i*.03,.12+i*.05]], .008, .001, joint, 4);
    const arm = Mesh.MergeMeshes(a.finish(), true, true, undefined, false, true)!; arm.name = "mantisForeleg";
    arm.parent = body; arm.position.set(side*.1,.86,.24); arms.push(arm); parts.push(arm);
    const w = new Form(scene, "mantis-wing");
    w.plane([side*.08,0,-.3], [.34,.78], [-Math.PI/2,0,0], wingMat);
    const wing = w.finish()[0]; wing.parent=body; wing.position.set(side*.04,.76,-.08); wing.rotation.x = -.12; wings.push(wing); parts.push(wing);
  }
  return { parts, arms, wings };
}

export function predecessorVisual(scene: Scene, node: TransformNode): Mesh[] {
  // Older relative of the player robot, slumped where it shut down: cracked ivory ceramic over a graphite frame,
  // binocular head drooping forward, solar panels folded on its back, rust-red Rebar Ivy draped over it.
  const ceramic = organic(scene, "predecessor-ceramic", "#c9bea6", "ceramic");
  const grime = organic(scene, "predecessor-grime", "#9a8f78", "ceramic");
  const metal = organic(scene, "predecessor-frame", "#33373a");
  const rust = organic(scene, "predecessor-rust", "#6e4430", "rusted");
  const lens = mat(scene, "predecessorLens", .02,.04,.05,.8);
  const solar = organic(scene, "predecessor-solar", "#2f3c4c");
  const ivy = cutout(scene, "predecessor-ivy", 256, ivyLeaves);
  const f = new Form(scene, "predecessor-form");
  // Pelvis on the deck, torso leaning back and to one side.
  f.ellipsoid([0, .2, -.05], [.34, .2, .26], metal);
  f.taper([[0, .25, -.08], [0, .5, -.16], [.02, .74, -.18]], .07, .06, metal);
  const chest = f.ellipsoid([.01, .62, -.12], [.4, .42, .26], ceramic); chest.rotation.set(-.25, 0, .08);
  f.ellipsoid([.01, .42, -.06], [.26, .14, .2], grime);
  // Neck and the wide binocular head, dropped forward onto the chest.
  f.taper([[.02, .8, -.18], [.04, .9, -.1], [.06, .92, .0]], .04, .035, metal);
  const head = f.ellipsoid([.07, .92, .06], [.56, .24, .3], ceramic, 10); head.rotation.set(.45, 0, -.2);
  for (const side of [-1, 1]) {
    const barrel = MeshBuilder.CreateCylinder("predecessor-form", { diameter: .18, height: .1, tessellation: 12 }, scene);
    barrel.position.set(.07 + side * .14, .87 - side * .03, .2); barrel.rotation.set(Math.PI / 2 + .45, 0, -.2); f.add(barrel, metal);
    f.ellipsoid([.07 + side * .14, .86 - side * .03, .25], [.13, .13, .03], lens);
    // Shoulder, upper arm hanging, forearm resting on the deck, three-fingered hand.
    f.ellipsoid([side * .25, .74, -.14], [.17, .17, .17], ceramic);
    f.taper([[side * .27, .7, -.12], [side * .33, .45, -.02], [side * .36, .22, .04]], .045, .035, metal);
    const upper = f.ellipsoid([side * .31, .52, -.06], [.1, .22, .1], ceramic); upper.rotation.z = side * .2;
    f.ellipsoid([side * .36, .22, .04], [.08, .08, .08], metal);
    f.taper([[side * .36, .22, .04], [side * .38, .08, .22], [side * .37, .04, .38]], .035, .03, metal);
    f.ellipsoid([side * .38, .08, .22], [.09, .08, .24], grime);
    for (const o of [-1, 0, 1]) f.taper([[side * .37, .04, .38], [side * .37 + o * .04, .02, .46], [side * .37 + o * .05, 0, .5]], .012, .006, metal, 4);
    // Legs: thighs forward, knees up, shins down to split feet.
    f.taper([[side * .13, .2, 0], [side * .17, .34, .32], [side * .19, .36, .42]], .06, .05, metal);
    const thigh = f.ellipsoid([side * .16, .3, .22], [.15, .14, .36], ceramic); thigh.rotation.x = -.35;
    f.ellipsoid([side * .19, .36, .44], [.11, .11, .11], rust);
    f.taper([[side * .19, .36, .44], [side * .22, .18, .62], [side * .24, .05, .72]], .045, .04, metal);
    const shin = f.ellipsoid([side * .21, .22, .6], [.12, .26, .12], ceramic); shin.rotation.x = .75;
    f.box([side * .25, .03, .8], [.12, .06, .24], metal);
    // Folded solar wing on the back.
    const panel = f.box([side * .17, .66, -.36], [.24, .46, .025], solar); panel.rotation.set(-.25, side * .3, side * .28);
    // Ivy climbing from the deck over the legs and chest.
    for (let i = 0; i < 5; i++) {
      f.plane([side * (.12 + i * .05), .24 + i * .14, .1 - i * .06], [.32, .32], [.3 + i * .4, side * (.6 + i), i * .7], ivy);
    }
  }
  // Missing panel on the chest exposes the dark frame; a crack line runs through the shell (ceramic grain).
  f.box([-.12, .64, .02], [.12, .14, .02], metal);
  return f.finish(node);
}

/** Lobed, rust-red Rebar Ivy leaves on short stems, for draping over props. */
function ivyLeaves(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  for (let i = 0; i < 26; i++) {
    const x = s * (.12 + r() * .76), y = s * (.12 + r() * .76), size = s * (.06 + r() * .06), a = r() * Math.PI * 2;
    const g = r();
    c.fillStyle = `rgb(${120 + g * 70},${40 + g * 34},${26 + g * 14})`;
    c.save(); c.translate(x, y); c.rotate(a);
    // Five pointed lobes like a vine maple leaf.
    c.beginPath();
    for (let k = 0; k <= 10; k++) {
      const t = (k / 10) * Math.PI * 2, rad = k % 2 ? size * .45 : size;
      c.lineTo(Math.cos(t) * rad, Math.sin(t) * rad);
    }
    c.fill();
    c.strokeStyle = "rgba(60,24,14,.7)"; c.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const t = (k / 5) * Math.PI * 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(t) * size * .8, Math.sin(t) * size * .8); c.stroke(); }
    c.restore();
  }
  c.strokeStyle = "#5a3a26"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, s * .8); c.bezierCurveTo(s * .3, s * .5, s * .6, s * .7, s, s * .2); c.stroke();
}

/** Weathered granite with lichen and moss in the hollows, shared by the guardians and stone lanterns. */
export function weatheredStone(scene: Scene): StandardMaterial {
  return organic(scene, "weathered-granite", "#7f7d70", "stone");
}

export function guardianVisual(scene: Scene, name: string, stone: StandardMaterial, openMouth: boolean): Mesh {
  // Seated komainu lion-dog: straight forelegs, haunches, a curled mane, bulging brows and an upright curly tail.
  // Faces local +z. Two variants: open mouth (a) and closed mouth (un).
  const f = new Form(scene, name);
  f.ellipsoid([0, .26, -.14], [.5, .44, .48], stone, 10);
  const chest = f.ellipsoid([0, .5, .06], [.42, .56, .34], stone, 10); chest.rotation.x = -.18;
  for (const side of [-1, 1]) {
    f.taper([[side * .13, .55, .16], [side * .14, .25, .2], [side * .14, .06, .22]], .08, .07, stone);
    f.ellipsoid([side * .14, .05, .27], [.15, .1, .18], stone);
    for (const o of [-1, 0, 1]) f.ellipsoid([side * .14 + o * .04, .04, .35], [.05, .06, .05], stone, 6);
    // Haunch and hind paw.
    f.ellipsoid([side * .2, .2, -.12], [.18, .3, .4], stone);
    f.ellipsoid([side * .2, .05, .04], [.12, .08, .18], stone);
    // Bulging eyes under heavy brows, ears flat to the mane.
    f.ellipsoid([side * .1, .98, .34], [.1, .08, .08], stone, 6);
    f.ellipsoid([side * .11, 1.03, .3], [.14, .06, .1], stone, 6);
    f.ellipsoid([side * .2, 1.05, .14], [.1, .12, .06], stone, 6);
    // Mane: a heavy mass behind the jaw, studded with small tight spiral curls.
    const mane = f.ellipsoid([side * .17, .9, .08], [.2, .42, .3], stone, 8); mane.rotation.z = side * .2;
  }
  // Big square head, a broad flat muzzle with a wide nose, and fangs at the corners of the mouth.
  f.ellipsoid([0, .97, .16], [.44, .38, .34], stone, 10);
  f.box([0, .87, .36], [.3, .16, .14], stone);
  f.ellipsoid([0, .92, .44], [.16, .08, .06], stone, 6);
  for (const side of [-1, 1]) f.taper([[side * .1, .82, .42], [side * .1, .76, .43]], .018, .004, stone, 4);
  // Open mouth: the lower jaw drops away from the muzzle; closed: it meets it.
  f.ellipsoid([0, openMouth ? .74 : .79, .33], [.25, .08, .14], stone);
  // Mane on the back and the flame-shaped curly tail standing up behind.
  f.ellipsoid([0, .92, -.02], [.4, .4, .26], stone, 8);
  for (let i = 0; i < 5; i++) f.ellipsoid([(i - 2) * .08, .98 - Math.abs(i - 2) * .05, -.15], [.08, .09, .06], stone, 6);
  // Tail: a flame of three tufts standing up behind the haunches, each ending in a curl.
  for (const [x, h] of [[-.07, .62], [0, .72], [.07, .6]] as const) {
    f.taper([[x, .3, -.42], [x * 1.4, h - .15, -.46], [x * 1.6, h, -.4]], .07, .03, stone);
    f.ellipsoid([x * 1.6, h, -.37], [.07, .09, .09], stone, 6);
  }
  const mesh = f.finish()[0];
  mesh.name = name;
  return mesh;
}
