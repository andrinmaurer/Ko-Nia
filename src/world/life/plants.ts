import {
  Color3,
  Mesh,
  Texture,
  VertexBuffer,
  MeshBuilder,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { rng } from "../textures";
import { mat } from "./materials";
import { Form, cutout, organic } from "./visuals";

/** The five MVP plant species. Positions match the Shrine Street greybox. */
export function createPlants(ctx: GameContext, shadows: ShadowGenerator): LifeForm[] {
  return [
    new LanternWisteria(ctx, shadows),
    new RebarIvy(ctx),
    new ShutterFerns(ctx),
    new SunLotus(ctx),
    new ChoirMoss(ctx),
  ];
}

/** Hangs under the overpass deck; pods glow at night. */
class LanternWisteria implements LifeForm {
  scannables: Scannable[];
  private readonly podMat: StandardMaterial;
  static readonly CENTER = new Vector3(-4.5, 3.8, 0.75);

  constructor(private readonly ctx: GameContext, shadows: ShadowGenerator) {
    const scene = ctx.scene;
    // Lantern Wisteria sheet: twisted woody stems, dense lilac-to-violet racemes, pinnate leaves
    // and cream papery lantern pods that glow blue-green only at night.
    const bark = organic(scene, "wisteria-stem", "#6a5a44", "bark");
    const flowerTop = organic(scene, "wisteria-bloom", "#bba6da");
    const flowerTip = organic(scene, "wisteria-bloom-tip", "#8466b4");
    const leaves = cutout(scene, "wisteria-leaflets", 256, pinnateLeaf);
    this.podMat = organic(scene, "wisteria-lantern", "#d9c9a0", "leaf");
    const random = rng(31);
    const form = new Form(scene, "lantern-wisteria");
    for (let z = -3; z <= 4.5; z += .9) {
      const h = 1.6 + Math.abs(Math.sin(z * 3.7)) * 1.2;
      form.taper([[-5.7,5.55,z],[-4.9,5.45,z+.25],[-4.1,5.52,z-.1],[-3.3,5.55,z]], .06, .03, bark);
      for (let j = 0; j < 4; j++) {
        const x = -5.4 + j * .58 + (random() - .5) * .2;
        const length = h * (.5 + j * .12) * (.8 + random() * .4);
        form.taper([[x,5.5,z],[x+.08,5.5-length*.4,z+.05],[x-.02,5.5-length*.8,z]], .018, .006, bark, 4);
        // Raceme: a cone of florets, broad and pale at the top, narrowing to violet tips.
        const top = 5.42 - length * .15, n = 7;
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1), y = top - t * length * .55, w = .17 * (1 - t * .75);
          for (const a of [0, 3.1]) {
            form.ellipsoid([x + Math.cos(a + k) * w * .45, y, z + Math.sin(a + k) * w * .45], [w * .8, .14, w * .8], t > .55 ? flowerTip : flowerTop, 4);
          }
        }
        for (let k = 0; k < 2; k++) {
          form.plane([x + .15, 5.4 - k * .35, z + (k ? -.12 : .12)], [.55, .4], [.2 + k * .5, j + k, 1.2], leaves);
        }
        // Lantern pod: a papery five-sided husk tapering to a point, hanging from its own stalk.
        if ((j + Math.round(z * 2)) % 2 === 0) {
          const py = 5.4 - length * .9;
          form.taper([[x - .12, 5.4, z + .1], [x - .14, py + .2, z + .1]], .006, .005, bark, 4);
          form.lathe([[0, .2], [.06, .17], [.11, .08], [.1, -.02], [.05, -.1], [0, -.14]], [x - .14, py, z + .1], this.podMat, 5);
        }
      }
    }
    const meshes = form.finish();
    for (const mesh of meshes) if (!mesh.material?.name.startsWith("card:")) shadows.addShadowCaster(mesh);
    this.scannables = [
      {
        entryId: "lantern-wisteria",
        meshes,
        getPosition: () => LanternWisteria.CENTER,
        isConditionMet: () => this.ctx.time.isNight,
      },
    ];
  }

  update(): void {
    const glow = 1 - this.ctx.time.daylight;
    this.podMat.emissiveColor.set(0.16 * glow, 0.65 * glow, 0.5 * glow);
  }
}

/** Alpha card: one pinnate wisteria leaf, leaflets in pairs along a central rachis. */
function pinnateLeaf(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  c.strokeStyle = "#4f5a30"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(s * .08, s * .5); c.quadraticCurveTo(s * .5, s * .42, s * .94, s * .5); c.stroke();
  for (let i = 0; i < 6; i++) {
    const x = s * (.18 + i * .13), g = r();
    c.fillStyle = `rgb(${84 + g * 40},${112 + g * 40},${48 + g * 18})`;
    for (const side of [-1, 1]) {
      c.save(); c.translate(x, s * .47); c.rotate(side * (1.1 - i * .08));
      c.beginPath(); c.ellipse(0, -s * .1 * side, s * .045, s * .1, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
  }
  c.beginPath(); c.ellipse(s * .95, s * .5, s * .1, s * .04, 0, 0, Math.PI * 2); c.fill();
}

/** Rust-red ivy on the façades, plus one wall it has split open. */
class RebarIvy implements LifeForm {
  scannables: Scannable[];

  constructor(ctx: GameContext) {
    const scene = ctx.scene;
    // Rebar Ivy sheet: lobed, rust-red iron-rich leaves on thick woody stems that track exposed metal.
    const ivyMat = cutout(scene, "rebar-ivy-wall", 512, rebarIvyTile);
    const tex = ivyMat.diffuseTexture as Texture;
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    const TILE = 2.4; // metres per texture repeat
    const patches: [number, number, number, number, number][] = [
      // x0, x1, wall z, y0, y1
      [-50, -42, 4.95, 0, 9],
      [-30, -18, 4.95, 0, 6],
      [26, 36, 4.95, 2, 8],
      [-40, -36, -4.95, 0, 7],
      [-10, -5, -4.95, 0, 10],
      [24, 30, -4.95, 1, 12],
    ];
    const plane = (name: string, w: number, h: number) => {
      const p = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
      // Scale UVs so leaf size stays the same on every patch.
      const uv = p.getVerticesData(VertexBuffer.UVKind)!;
      for (let i = 0; i < uv.length; i += 2) { uv[i] *= w / TILE; uv[i + 1] *= h / TILE; }
      p.setVerticesData(VertexBuffer.UVKind, uv);
      p.material = ivyMat;
      return p;
    };
    const planes = patches.map(([x0, x1, z, y0, y1]) => {
      const p = plane(`ivy${x0}${z}`, x1 - x0, y1 - y0);
      p.position.set((x0 + x1) / 2, (y0 + y1) / 2, z + (z > 0 ? -0.02 : 0.02));
      if (z < 0) p.rotation.y = Math.PI;
      return p;
    });

    // The split wall: a crack in the southC façade with thick woody stems forcing into it.
    const crackMat = mat(scene, "crack", 0.08, 0.07, 0.07);
    const stemMat = organic(scene, "rebar-ivy-stem", "#5b3a26", "bark");
    const rebar = organic(scene, "rebar-ivy-rebar", "#6b3d24", "rusted");
    const crack = MeshBuilder.CreateBox("ivyCrack", { width: 0.5, height: 4, depth: 0.1 }, scene);
    crack.position.set(-2.3, 2, -4.95);
    crack.rotation.z = 0.12;
    crack.material = crackMat;
    const split: Mesh[] = [crack];
    const stems = new Form(scene, "ivySplitStems");
    for (let i = 0; i < 5; i++) {
      const x = -3.4 + i * .55, s = i % 2 ? -1 : 1;
      stems.taper([[x, 0, -4.85], [x + s * .3, 1.2, -4.83], [-2.3 + s * .1, 2.4 + i * .2, -4.87], [-2.2 - s * .5, 3.6, -4.84]], .07, .025, stemMat);
    }
    // Exposed rebar the ivy follows up through the crack.
    for (const x of [-2.5, -2.1]) stems.taper([[x, .3, -4.9], [x + .05, 3.8, -4.9]], .018, .018, rebar, 5);
    split.push(...stems.finish());
    const leaves = plane("ivySplitLeaves", 3, 2.5);
    leaves.position.set(-2.3, 1.6, -4.9);
    leaves.rotation.y = Math.PI;
    split.push(leaves);

    this.scannables = [
      ...planes.map((p) => ({ entryId: "rebar-ivy", meshes: [p], getPosition: () => p.position })),
      { entryId: "rebar-ivy", meshes: split, getPosition: () => crack.position, isConditionMet: () => true },
    ];
  }

  update(): void {}
}

/** Tileable alpha card: woody ivy stems wandering upwards with five-lobed rust-red leaves along them. */
function rebarIvyTile(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  const wrap = (x: number) => ((x % s) + s) % s;
  const stems: [number, number][][] = [];
  for (let k = 0; k < 7; k++) {
    let x = r() * s, y = s;
    const path: [number, number][] = [[x, y + 20]];
    while (y > -20) { x += (r() - .5) * 40; y -= 18 + r() * 20; path.push([x, y]); }
    stems.push(path);
    c.strokeStyle = "#4e3423"; c.lineWidth = 3 + r() * 3;
    for (const dx of [-s, 0, s]) { c.beginPath(); path.forEach(([px, py], i) => i ? c.lineTo(px + dx, py) : c.moveTo(px + dx, py)); c.stroke(); }
  }
  for (let i = 0; i < 560; i++) {
    const path = stems[i % stems.length], p = path[Math.floor(r() * path.length)];
    const x = wrap(p[0] + (r() - .5) * 70), y = wrap(p[1] + (r() - .5) * 50), size = 9 + r() * 8, a = r() * Math.PI * 2;
    const g = r(), dry = r() > .8;
    const fill = dry ? `rgb(${150 + g * 40},${100 + g * 30},${50})` : `rgb(${110 + g * 80},${34 + g * 38},${22 + g * 16})`;
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const cx = x + dx, cy = y + dy;
      if (cx < -30 || cx > s + 30 || cy < -30 || cy > s + 30) continue;
      c.save(); c.translate(cx, cy); c.rotate(a); c.fillStyle = fill;
      c.beginPath();
      for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2, rad = k % 2 ? size * .5 : size * (k === 0 || k === 10 ? 1.1 : .9); c.lineTo(Math.cos(t) * rad, Math.sin(t) * rad); }
      c.fill();
      c.strokeStyle = "rgba(55,20,12,.6)"; c.lineWidth = 1;
      for (let k = 0; k < 5; k++) { const t = (k / 5) * Math.PI * 2 - Math.PI / 2; c.beginPath(); c.moveTo(0, size * .2); c.lineTo(Math.cos(t) * size * .8, Math.sin(t) * size * .8); c.stroke(); }
      c.restore();
    }
  }
}

/** Fern clusters that snap shut when something approaches quickly. */
class ShutterFerns implements LifeForm {
  scannables: Scannable[] = [];
  private readonly ferns: { mesh: Mesh; open: boolean; calm: number }[] = [];
  private readonly openMat: StandardMaterial;
  private readonly closedMat: StandardMaterial;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    // Shutter Fern sheet: dark olive fronds with a bright yellow-green inner pattern, curled fiddleheads.
    const fronds = cutout(scene, "shutter-fern", 256, shutterFernCard);
    const tinted = (name: string, tint: Color3) => {
      const m = fronds.clone(`card:${name}`);
      m.diffuseColor = tint;
      return m;
    };
    this.openMat = tinted("fernOpen", new Color3(1, 1, 1));

    this.closedMat = tinted("fernClosed", new Color3(0.62, 0.7, 0.55));
    for (let x = -50; x < 40; x += 7 + (Math.abs(x) % 5)) {
      for (const z of [-4.6, 4.6]) {
        const cards: Mesh[] = [];
        for (let i = 0; i < 4; i++) {
          const p = MeshBuilder.CreatePlane("fernCard", { width: .9, height: .7 }, scene);
          p.position.y = .2;
          p.rotation.set(0.18, (i / 4) * Math.PI + x, 0);
          p.bakeCurrentTransformIntoVertices();
          cards.push(p);
        }
        const mesh = Mesh.MergeMeshes(cards, true)!;
        mesh.name = `fern${x}${z}`;
        mesh.position.set(x, 0.15, z);
        const fern = { mesh, open: true, calm: 0 };
        this.ferns.push(fern);
        this.scannables.push({
          entryId: "shutter-fern",
          meshes: [mesh],
          getPosition: () => mesh.position,
          isConditionMet: () => fern.open && Vector3.Distance(mesh.position, this.ctx.robot.position) <= 6,
        });
      }
    }
  }

  update(dt: number): void {
    const robot = this.ctx.robot.position;
    const speed = this.ctx.robotSpeed;
    const triggerRadius = this.ctx.robot.isSprinting ? 8 : speed > 3 ? 4 : speed > 0.1 ? 1.2 : 0;
    for (const f of this.ferns) {
      const near = Vector3.Distance(f.mesh.position, robot) < triggerRadius;
      if (near) {
        f.open = false;
        f.calm = 0;
      } else if (!f.open) {
        f.calm += dt;
        if (f.calm > 3) f.open = true;
      }
      const target = f.open ? 1 : 0.45;
      const s = f.mesh.scaling;
      const k = Math.min(1, dt * (f.open ? 2 : 14));
      s.x += (target - s.x) * k;
      s.z = s.x;
      s.y += ((f.open ? 1 : 0.6) - s.y) * k;
      f.mesh.material = f.open ? this.openMat : this.closedMat;
    }
  }
}

/** Lotus in the flooded pothole; turns with the sun. */
class SunLotus implements LifeForm {
  scannables: Scannable[];
  private readonly pads: TransformNode;
  private readonly bloom: Mesh;
  static readonly POS = new Vector3(25, 0, -1.5);

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    // Sun Lotus sheet: broad crinkled pads (some held above the water), a tall flexible stalk,
    // a large pink-tipped bloom around a golden seed cup, and closed buds.
    const padMat = organic(scene, "lotus-leaf", "#5f7d3a", "leaf");
    const bloomMat = organic(scene, "lotus-petal-tip", "#e59bb2");
    const innerMat = organic(scene, "lotus-petal-inner", "#f4dde0");
    const centerMat = organic(scene, "lotus-seed-cup", "#c6a23e");
    const stemMat = organic(scene, "lotus-stalk", "#5c7046");
    this.pads = new TransformNode("lotusPads", scene);
    this.pads.position.copyFrom(SunLotus.POS);
    const form = new Form(scene,"sun-lotus-base");
    for (const [dx,dz,r,lift] of [[.6,.35,.5,0],[-.6,-.35,.48,0],[.1,-.8,.42,0],[-.35,.6,.4,0],[.45,-.3,.34,.35],[-.25,.05,.3,.5]] as const) {
      // Shallow saucer with an upturned rim; emergent pads stand on their own stalks.
      const y = .05 + lift;
      form.lathe([[0,.012],[r*.5,0],[r*.9,.02],[r,.06]], [dx,y,dz], padMat, 14);
      if (lift) form.taper([[dx,.02,dz],[dx+.03,y*.6,dz],[dx,y,dz]], .012, .01, stemMat, 5);
    }
    form.taper([[0,.03,0],[.05,.45,.02],[.1,.95,0]], .025, .018, stemMat);
    // Two closed buds on their own stalks.
    for (const [bx,bz,h] of [[-.4,.25,.55],[.5,.55,.42]] as const) {
      form.taper([[bx,.03,bz],[bx+.03,h*.6,bz],[bx+.02,h,bz]], .014, .01, stemMat, 5);
      form.lathe([[0,0],[.05,.04],[.055,.1],[.03,.16],[0,.2]], [bx+.02,h,bz], bloomMat, 8);
    }
    const meshes=form.finish(this.pads);
    const bloom=new Form(scene,"lotusBloom");
    // Three rings of cupped, pointed petals, white-pink inside and pink at the tips, around a seed cup.
    for(let ring=0;ring<3;ring++) for(let i=0;i<8;i++) {
      const a=(i/8)*Math.PI*2+ring*.39, d=.07+ring*.05;
      const petal=bloom.ellipsoid([Math.cos(a)*d,.06-ring*.035,Math.sin(a)*d],[.13+ring*.02,.06,.32-ring*.03],ring===0?innerMat:bloomMat,6);
      petal.rotation.y=Math.PI/2-a;petal.rotation.x=-.9+ring*.35;
    }
    bloom.lathe([[0,.1],[.06,.1],[.075,.06],[.04,0]], [0,0,0], centerMat, 10);
    this.bloom=Mesh.MergeMeshes(bloom.finish(),true,true,undefined,false,true)!;
    this.bloom.name="lotusBloom";this.bloom.position.set(.1,.97,0);this.bloom.parent=this.pads;
    meshes.push(this.bloom);

    this.scannables = [
      {
        entryId: "sun-lotus",
        meshes,
        getPosition: () => SunLotus.POS.add(new Vector3(0, 0.6, 0)),
        // Observed once it has been scanned at two clearly different times of day.
        isConditionMet: () => {
          const now = this.ctx.time.hours;
          return this.ctx.logbook.get("sun-lotus").scanHours.some((h) => hourDistance(h, now) >= 4);
        },
      },
    ];
  }

  update(): void {
    const hours = this.ctx.time.hours;
    this.pads.rotation.y = ((hours - 6) / 12) * Math.PI;
    const open = 0.45 + 0.55 * this.ctx.time.daylight;
    this.bloom.scaling.set(open, 0.8 + 0.2 * open, open);
  }
}

/** Moss on the shrine statues that whistles in the wind. */
class ChoirMoss implements LifeForm {
  scannables: Scannable[] = [];
  private readonly stalks: Mesh[] = [];
  private announced = false;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    // Emerald cushions bristling with yellow-green hollow trumpets of different lengths (Choir Moss sheet).
    const mossMat = organic(scene, "choir-cushion", "#4f6a2c", "moss");
    const stalkMat = organic(scene, "choir-trumpet", "#9aa443");
    const hollow = mat(scene, "choirHollow", .07, .08, .03);
    const random = rng(7);
    for (const z of [-3.5, 3.5]) {
      // One cushion over the guardian's back and mane, one spilling over the pedestal's front edge.
      const patches: [number, number, number, number][] = [[47.38, 1.88, z, .22], [47.08, .86, z + (z < 0 ? .22 : -.22), .2]];
      const cushions = new Form(scene, `choirMoss${z}`);
      const groups = [0, 1, 2].map(() => new Form(scene, `choirStalks${z}`));
      for (const [x, y, cz, r] of patches) {
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1;
          cushions.ellipsoid([x + Math.cos(a) * r * .45, y + (i % 2) * .02, cz + Math.sin(a) * r * .5], [r * .9, r * .32, r], mossMat, 7);
        }
        for (let i = 0; i < Math.round(r * 60); i++) {
          const a = random() * Math.PI * 2, d = Math.sqrt(random()) * r * .7;
          const px = x + Math.cos(a) * d, pz = cz + Math.sin(a) * d, h = .03 + random() * .05;
          const base = y + r * .14 - d * .2;
          const g = groups[i % 3];
          // Narrow stalk flaring into a trumpet rim with a dark opening.
          g.taper([[px, base, pz], [px, base + h * .7, pz], [px, base + h, pz]], .005, .012, stalkMat, 5);
          const rim = g.ring([px, base + h, pz], .024, .006, stalkMat); rim.scaling.y = .6;
          const hole = g.ellipsoid([px, base + h + .001, pz], [.014, .003, .014], hollow, 4);
          hole.isPickable = false;
        }
      }
      const meshes: Mesh[] = cushions.finish();
      for (const g of groups) {
        const merged = Mesh.MergeMeshes(g.finish(), true, true, undefined, false, true)!;
        merged.name = `choirStalks${z}`;
        // Pivot at the cushion so the trumpets lean together in a gust.
        merged.setPivotPoint(new Vector3(patches[0][0], patches[0][1], patches[0][2]));
        this.stalks.push(merged);
        meshes.push(merged);
      }
      this.scannables.push({
        entryId: "choir-moss",
        meshes,
        getPosition: () => new Vector3(patches[0][0], patches[0][1], patches[0][2]),
        isConditionMet: () => this.ctx.wind.gusting,
      });
    }
    ctx.wind.onGust((gusting) => {
      if (!gusting) return;
      const near = Vector3.Distance(this.ctx.robot.position, new Vector3(47.5, 0, 0)) < 35;
      if (near) this.ctx.caption("♪ A soft whistling chord drifts from the shrine", 7);
      else if (!this.announced && this.ctx.robot.position.y > -1) this.ctx.caption("Wind gusts through the street", 4);
      // Underground there is no wind to hear; announce it next time.
      if (near || this.ctx.robot.position.y > -1) this.announced = true;
    });
  }

  update(): void {
    const t = performance.now() / 1000;
    const s = this.ctx.wind.strength;
    this.stalks.forEach((stalk, i) => {
      stalk.rotation.x = Math.sin(t * 9 + i) * 0.04 * s;
      stalk.rotation.z = Math.cos(t * 7 + i * 2) * 0.04 * s;
    });
  }
}

/** Alpha card: arching jointed fronds, dark olive with a bright inner stripe on each pinna, two fiddleheads. */
function shutterFernCard(c: CanvasRenderingContext2D, s: number, r: () => number): void {
  for (let f = 0; f < 10; f++) {
    const angle = -Math.PI / 2 + (f / 9 - 0.5) * 2.4 + (r() - 0.5) * 0.2;
    const len = s * (0.5 + r() * 0.42);
    const bend = (f / 9 - 0.5) * 1.1;
    let x = s / 2, y = s, a = angle;
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const nx = x + Math.cos(a) * (len / steps), ny = y + Math.sin(a) * (len / steps);
      a += bend * 0.07;
      c.strokeStyle = "#3f3220"; c.lineWidth = 2.6 * (1 - t) + 0.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(nx, ny); c.stroke();
      const leaf = (1 - t * 0.85) * s * 0.06 + 2;
      for (const side of [-1, 1]) {
        const la = a + side * 1.25, cx = nx + Math.cos(la) * leaf * 0.55, cy = ny + Math.sin(la) * leaf * 0.55;
        const g = r();
        c.fillStyle = `rgb(${44 + g * 20},${58 + g * 18},${26 + g * 8})`;
        c.beginPath(); c.ellipse(cx, cy, leaf * 0.6, Math.max(1.4, leaf * 0.2), la, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgba(${150 + g * 40},${176 + g * 30},60,0.85)`;
        c.beginPath(); c.ellipse(cx, cy, leaf * 0.38, Math.max(0.6, leaf * 0.07), la, 0, Math.PI * 2); c.fill();
      }
      x = nx; y = ny;
    }
  }
  // Two unrolling fiddleheads near the base.
  c.strokeStyle = "#4a3a22"; c.lineWidth = 4;
  for (const [cx, cy] of [[s * .42, s * .72], [s * .6, s * .76]]) {
    c.beginPath(); c.moveTo(cx, s); c.lineTo(cx, cy); c.arc(cx + 8, cy, 8, Math.PI, Math.PI * 2.7); c.stroke();
  }
}

function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}
