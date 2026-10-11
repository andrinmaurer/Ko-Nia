import {
  Color3,
  Mesh,
  MeshBuilder,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "../../babylon";
import type { GameContext, LifeForm, Scannable } from "../../game/context";
import { card } from "../textures";
import { mat } from "./materials";
import { Form, organic } from "./visuals";

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
    const bark = organic(scene, "wisteria-bark", "#5f5742");
    const flower = organic(scene, "wisteria-flower", "#b7a3c3");
    const leaves = organic(scene, "wisteria-leaf", "#657545", "leaf");
    this.podMat = organic(scene, "wisteriaPod", "#cec3a0");
    const form = new Form(scene, "lantern-wisteria");
    for (let z = -3; z <= 4.5; z += .9) {
      const h = 1.6 + Math.abs(Math.sin(z * 3.7)) * 1.2;
      form.branch([[-5.6,5.55,z],[-4.7,5.5,z+.2],[-3.4,5.55,z]], .035,bark);
      for (let j=0;j<4;j++) {
        const x=-5.4+j*.58;
        const length=h*(.55+j*.12);
        form.branch([[x,5.5,z],[x+.1,5.5-length*.5,z+.04],[x,5.5-length,z]],.012,bark);
        for(let k=0;k<7;k++) {
          const y=5.35-k*length/7;
          form.ellipsoid([x+Math.sin(k*2)*.055,y,z],[.13*(1-k*.06),.17,.09],flower,6);
        }
        for(let k=0;k<3;k++) {
          const leaf=form.ellipsoid([x+.1,5.45-k*.25,z+.08],[.24,.025,.1],leaves,6);
          leaf.rotation.z=.4-k*.4;
        }
        const pod=form.ellipsoid([x,5.4-length-.08,z],[.18,.27,.18],this.podMat,6);
        pod.rotation.z=Math.sin(z+j)*.12;
      }
    }
    const meshes = form.finish();
    for(const mesh of meshes) shadows.addShadowCaster(mesh);
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

/** Rust-red ivy on the façades, plus one wall it has split open. */
class RebarIvy implements LifeForm {
  scannables: Scannable[];

  constructor(ctx: GameContext) {
    const scene = ctx.scene;
    const ivyMat = card(scene,"ivy").clone("rebarIvyLeaves");
    ivyMat.diffuseColor = new Color3(.85,.38,.21);
    ivyMat.specularColor = Color3.Black();
    ivyMat.backFaceCulling = false;
    const patches: [number, number, number, number, number][] = [
      // x0, x1, wall z, y0, y1
      [-50, -42, 4.95, 0, 9],
      [-30, -18, 4.95, 0, 6],
      [26, 36, 4.95, 2, 8],
      [-40, -36, -4.95, 0, 7],
      [-10, -5, -4.95, 0, 10],
      [24, 30, -4.95, 1, 12],
    ];
    const planes = patches.map(([x0, x1, z, y0, y1]) => {
      const p = MeshBuilder.CreatePlane(`ivy${x0}${z}`, { width: x1 - x0, height: y1 - y0 }, scene);
      p.position.set((x0 + x1) / 2, (y0 + y1) / 2, z + (z > 0 ? -0.02 : 0.02));
      if (z < 0) p.rotation.y = Math.PI;
      p.material = ivyMat;
      return p;
    });

    // The split wall: a crack in the southC façade with thick stems growing into it.
    const crackMat = mat(scene, "crack", 0.08, 0.07, 0.07);
    const stemMat = mat(scene, "ivyStem", 0.36, 0.17, 0.1);
    const crack = MeshBuilder.CreateBox("ivyCrack", { width: 0.5, height: 4, depth: 0.1 }, scene);
    crack.position.set(-2.3, 2, -4.95);
    crack.rotation.z = 0.12;
    crack.material = crackMat;
    const split: Mesh[] = [crack];
    for (let i = 0; i < 4; i++) {
      const stem = MeshBuilder.CreateCylinder(`ivySplitStem${i}`, { diameter: 0.12, height: 2.2 }, scene);
      stem.position.set(-3.2 + i * 0.6, 1.2 + i * 0.5, -4.85);
      stem.rotation.z = (i % 2 ? -1 : 1) * 0.7;
      stem.material = stemMat;
      split.push(stem);
    }
    const leaves = MeshBuilder.CreatePlane("ivySplitLeaves", { width: 3, height: 2.5 }, scene);
    leaves.position.set(-2.3, 1.6, -4.9);
    leaves.rotation.y = Math.PI;
    leaves.material = ivyMat;
    split.push(leaves);

    this.scannables = [
      ...planes.map((p) => ({ entryId: "rebar-ivy", meshes: [p], getPosition: () => p.position })),
      { entryId: "rebar-ivy", meshes: split, getPosition: () => crack.position, isConditionMet: () => true },
    ];
  }

  update(): void {}
}

/** Fern clusters that snap shut when something approaches quickly. */
class ShutterFerns implements LifeForm {
  scannables: Scannable[] = [];
  private readonly ferns: { mesh: Mesh; open: boolean; calm: number }[] = [];
  private readonly openMat: StandardMaterial;
  private readonly closedMat: StandardMaterial;

  constructor(private readonly ctx: GameContext) {
    const scene = ctx.scene;
    // Brighter, larger and more yellow than the common ferns around them.
    const fronds = card(scene, "fern");
    const tinted = (name: string, tint: Color3) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseTexture = fronds.diffuseTexture;
      m.diffuseColor = tint;
      m.specularColor = Color3.Black();
      m.backFaceCulling = false;
      m.alphaCutOff = fronds.alphaCutOff;
      return m;
    };
    this.openMat = tinted("fernOpen", new Color3(1.08, 1.12, .66));

    this.closedMat = tinted("fernClosed", new Color3(0.5, 0.75, 0.45));
    for (let x = -50; x < 40; x += 7 + (Math.abs(x) % 5)) {
      for (const z of [-4.6, 4.6]) {
        const cards: Mesh[] = [];
        for (let i = 0; i < 4; i++) {
          const p = MeshBuilder.CreatePlane("fernCard", { width: 1, height: .65 }, scene);
          p.position.y = .14;
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
    const padMat = organic(scene, "lotus-pad", "#617c44", "leaf");
    const bloomMat = organic(scene, "lotus-petal", "#e9bdc7");
    const centerMat = organic(scene, "lotus-pollen", "#b79c43");
    const stemMat = organic(scene, "lotus-stem", "#5c7046");
    this.pads = new TransformNode("lotusPads", scene);
    this.pads.position.copyFrom(SunLotus.POS);
    const form = new Form(scene,"sun-lotus-base");
    for (const [dx,dz,r] of [[.45,.25,.36],[-.45,-.3,.35],[.1,-.6,.32],[-.2,.5,.28]]) {
      const pad=MeshBuilder.CreateDisc("lotusPad",{radius:r,tessellation:24,arc:.94},scene);
      pad.rotation.x=Math.PI/2;pad.position.set(dx,.06,dz);form.add(pad,padMat);
      for(let i=0;i<8;i++) {
        const a=i*Math.PI/4;
        form.branch([[dx,.065,dz],[dx+Math.cos(a)*r*.9,.065,dz+Math.sin(a)*r*.9]],.003,stemMat);
      }
    }
    form.branch([[0,.03,0],[.04,.4,0],[.1,.78,0]],.022,stemMat);
    const meshes=form.finish(this.pads);
    const bloom=new Form(scene,"lotusBloom");
    // Layered pointed petals, with a visible pollen cup instead of a pink ball.
    for(let ring=0;ring<2;ring++) for(let i=0;i<8;i++) {
      const a=(i/8)*Math.PI*2+ring*.35;
      const petal=bloom.ellipsoid([Math.cos(a)*(.1+ring*.035),.04-ring*.03,Math.sin(a)*(.1+ring*.035)],[.1,.055,.28],bloomMat,6);
      petal.rotation.y=Math.PI/2-a;petal.rotation.x=.25+ring*.2;
    }
    bloom.ellipsoid([0,.08,0],[.13,.07,.13],centerMat);
    this.bloom=Mesh.MergeMeshes(bloom.finish(),true,true,undefined,false,true)!;
    this.bloom.name="lotusBloom";this.bloom.position.set(.1,.8,0);this.bloom.parent=this.pads;
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
    const mossMat = organic(scene, "choir-moss", "#526a37");
    const stalkMat = mat(scene, "choirStalk", 0.55, 0.65, 0.35);
    for (const z of [-3.5, 3.5]) {
      const cap = MeshBuilder.CreateSphere(`choirMoss${z}`, { diameter: 0.95, segments: 8 }, scene);
      cap.scaling.y = 0.4;
      cap.position.set(47.5, 2.05, z);
      cap.material = mossMat;
      const meshes: Mesh[] = [cap];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const stalk = MeshBuilder.CreateCylinder(`choirStalk${z}${i}`, { diameter: .025, height: .045 + (i % 3) * .015 }, scene);
        stalk.position.set(47.5 + Math.cos(a) * .25, 2.22, z + Math.sin(a) * .25);
        stalk.material = stalkMat;
        // A dark opening and a rim make the wind instruments read as hollow stalks.
        const rim=MeshBuilder.CreateTorus(`choirRim${z}${i}`,{diameter:.027,thickness:.008,tessellation:8},scene);
        rim.material=stalkMat;rim.parent=stalk;rim.position.y=(.045+(i%3)*.015)/2;
        const opening=MeshBuilder.CreateDisc(`choirOpening${z}${i}`,{radius:.009,tessellation:8},scene);
        opening.material=mat(scene,"choirHollow",.055,.07,.025);
        opening.parent=stalk;opening.rotation.x=-Math.PI/2;opening.position.y=rim.position.y+.001;
        meshes.push(rim,opening);
        this.stalks.push(stalk);
        meshes.push(stalk);
      }
      this.scannables.push({
        entryId: "choir-moss",
        meshes,
        getPosition: () => cap.position,
        isConditionMet: () => this.ctx.wind.gusting,
      });
    }
    ctx.wind.onGust((gusting) => {
      if (!gusting) return;
      const near = Vector3.Distance(this.ctx.robot.position, new Vector3(47.5, 0, 0)) < 35;
      if (near) this.ctx.caption("♪ A soft whistling chord drifts from the shrine", 7);
      else if (!this.announced) this.ctx.caption("Wind gusts through the street", 4);
      this.announced = true;
    });
  }

  update(): void {
    const t = performance.now() / 1000;
    const s = this.ctx.wind.strength;
    this.stalks.forEach((stalk, i) => {
      stalk.rotation.x = Math.sin(t * 9 + i) * 0.35 * s;
      stalk.rotation.z = Math.cos(t * 7 + i * 2) * 0.35 * s;
    });
  }
}

function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}
