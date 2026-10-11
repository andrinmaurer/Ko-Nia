import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "../../babylon";
import { rng } from "../textures";
import { mat } from "./materials";

type Point = [number, number, number];

/** Small shared painted surfaces. Relief is baked into colour, never a normal-map pass. */
export function organic(scene: Scene, name: string, colour: string, grain: "fur" | "shell" | "leaf" | "ceramic" = "shell"): StandardMaterial {
  const key = `organism:${name}`;
  const previous = scene.getMaterialByName(key);
  if (previous instanceof StandardMaterial) return previous;
  const base = Color3.FromHexString(colour);
  const material = mat(scene, key, 1, 1, 1, grain === "ceramic" ? 0.18 : 0.06);
  const texture = new DynamicTexture(key, 128, scene, true);
  const c = texture.getContext() as unknown as CanvasRenderingContext2D;
  c.fillStyle = colour;
  c.fillRect(0, 0, 128, 128);
  const random = rng([...name].reduce((seed, ch) => seed * 31 + ch.charCodeAt(0), 0));
  for (let i = 0; i < 480; i++) {
    const x = random() * 128, y = random() * 128;
    const light = random() > 0.55;
    c.strokeStyle = light ? "rgba(225,216,181,.12)" : "rgba(24,30,24,.18)";
    c.lineWidth = grain === "fur" ? 0.6 : 1;
    c.beginPath(); c.moveTo(x, y);
    c.lineTo(x + (random() - 0.5) * 6, y + (grain === "fur" ? 9 : 2)); c.stroke();
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
  const feather = organic(scene, "hookbill-feathers", "#242a2b", "fur");
  feather.specularColor = new Color3(0.3, 0.16, 0.07);
  const copper = organic(scene, "hookbill-copper", "#514132", "fur");
  const horn = organic(scene, "hookbill-horn", "#655a40");
  const eye = mat(scene, "wildlifeEye", 0.025, 0.035, 0.025, 0.65);
  const f = new Form(scene, "hookbill-form");
  f.ellipsoid([0, .34, -.06], [.31, .4, .5], feather);
  f.ellipsoid([0, .55, .18], [.21, .28, .22], feather);
  f.ellipsoid([0, .66, .25], [.22, .2, .23], feather);
  f.branch([[0,.65,.34],[0,.62,.47],[0,.56,.51]], .035, horn);
  for (const side of [-1, 1]) {
    f.ellipsoid([side * .095,.68,.29], [.036,.034,.035], eye);
    f.branch([[side*.085,.18,0],[side*.08,.04,.04]], .018, horn);
    // Three forward toes and one opposing toe per foot.
    for (const offset of [-1,0,1]) f.branch([[side*.08,.04,.04],[side*.08+offset*.035,.025,.14+Math.abs(offset)*.015]], .009, horn);
    f.branch([[side*.08,.04,.04],[side*.11,.025,-.025]], .009, horn);
  }
  for (let i = -2; i <= 2; i++) {
    const tail = f.ellipsoid([i*.035,.26,-.37], [.065,.035,.32], i%2 ? copper : feather);
    tail.rotation.x = -.15;
  }
  const parts = f.finish(node), wings: Mesh[] = [];
  for (const side of [-1,1]) {
    const wing = new Form(scene, "hookbill-wing");
    for (let i = 0; i < 6; i++) {
      const p = wing.ellipsoid([side*(.015+i*.025),-.07-i*.013,-.1-i*.027], [.06,.18,.25], i%2 ? feather : copper);
      p.rotation.z = side*.18;
    }
    const meshes = wing.finish();
    // One material keeps a wing to a single draw call while retaining copper highlights.
    const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, true)!;
    merged.name = "hookbillWing"; merged.parent = node; merged.position.set(side*.13,.4,0);
    wings.push(merged); parts.push(merged);
  }
  return { parts, wings };
}

export function drainbackVisual(scene: Scene, node: TransformNode): Mesh[] {
  const fur = organic(scene, "drainback-fur", "#66584b", "fur");
  const shell = organic(scene, "drainback-plates", "#686752");
  const pink = mat(scene, "drainbackEars", .44,.29,.24);
  const dark = mat(scene, "wildlifeEye", .025,.035,.025,.65);
  const whisker = mat(scene, "whisker", .64,.58,.44);
  const f = new Form(scene, "drainback-form");
  f.ellipsoid([0,.25,-.05], [.35,.36,.65], fur);
  f.ellipsoid([0,.23,.32], [.22,.22,.26], fur);
  f.ellipsoid([0,.21,.45], [.1,.08,.12], pink);
  f.branch([[0,.15,-.35],[.05,.06,-.6],[.16,.035,-.9]], .022, fur);
  for (const side of [-1,1]) {
    f.ellipsoid([side*.095,.35,.27], [.095,.12,.035], pink);
    f.ellipsoid([side*.08,.27,.38], [.032,.03,.032], dark);
    for (const z of [-.23,.17]) {
      f.branch([[side*.13,.18,z],[side*.16,.055,z+.015]], .03, fur);
      f.ellipsoid([side*.16,.035,z+.05], [.075,.05,.12], fur);
    }
    for (let i = 0; i < 3; i++) f.branch([[side*.04,.22,.43],[side*(.15+i*.025),.22+(i-1)*.025,.45]], .0025, whisker);
  }
  for (let row = 0; row < 5; row++) for (let col = -1; col <= 1; col++) {
    const p = f.ellipsoid([col*.105,.385-Math.abs(col)*.035,-.27+row*.115], [.14,.09,.18], shell, 6);
    p.rotation.x = -.2; p.rotation.z = -col*.4;
  }
  return f.finish(node);
}

export function mantisVisual(scene: Scene, body: TransformNode): { parts: Mesh[]; arms: Mesh[]; wings: Mesh[] } {
  const shell = organic(scene, "mantis-camouflage", "#687461");
  const joint = organic(scene, "mantis-joints", "#414b37");
  const pale = organic(scene, "mantis-wing", "#9b9b76", "leaf");
  const eye = mat(scene, "mantisEyes", .4,.45,.23,.3);
  const f = new Form(scene, "mantis-form");
  f.ellipsoid([0,.55,-.32], [.35,.25,.72], shell);
  f.branch([[0,.58,-.05],[0,.78,.1],[0,1.01,.28]], .065, joint);
  const head = f.ellipsoid([0,1.03,.3], [.29,.14,.13], shell, 4);
  head.rotation.z = Math.PI;
  for (const side of [-1,1]) {
    f.ellipsoid([side*.125,1.08,.32], [.085,.09,.07], eye);
    f.branch([[side*.065,1.09,.31],[side*.14,1.27,.36],[side*.2,1.38,.48]], .006, joint);
    // Exactly four walking legs; the two raptorial arms below make six total limbs.
    for (const z of [-.4,-.08]) f.branch([[side*.12,.58,z],[side*.37,.5,z-.12],[side*.48,.04,z+.1]], .021, joint);
    for (let i = 0; i < 5; i++) f.ellipsoid([side*.08,.58,-.55+i*.11], [.16,.2,.13], shell, 6);
  }
  const parts = f.finish(body), arms: Mesh[] = [], wings: Mesh[] = [];
  for (const side of [-1,1]) {
    const a = new Form(scene, "mantis-foreleg");
    a.branch([[0,0,0],[side*.08,-.23,.14],[side*.09,-.35,.23],[side*.08,-.15,.27]], .028, shell);
    for (let i=0;i<4;i++) a.branch([[side*.09,-.33+i*.045,.23],[side*.09,-.32+i*.045,.19]], .008, shell);
    const arm = a.finish()[0]; arm.parent = body; arm.position.set(side*.12,.83,.25); arms.push(arm); parts.push(arm);
    const w = new Form(scene, "mantis-wing");
    const leaf = w.ellipsoid([side*.07,0,-.15], [.16,.035,.62], pale); leaf.rotation.y = side*.08;
    const wing = w.finish()[0]; wing.parent=body; wing.position.set(side*.04,.67,-.1); wings.push(wing); parts.push(wing);
  }
  return { parts, arms, wings };
}

export function predecessorVisual(scene: Scene, node: TransformNode): Mesh[] {
  const ceramic = organic(scene, "predecessor-shell", "#c0b6a0", "ceramic");
  const metal = organic(scene, "predecessor-frame", "#353b39");
  const lens = mat(scene, "predecessorLens", .025,.045,.055,.5);
  const solar = organic(scene, "predecessor-solar", "#344454");
  const ivy = organic(scene, "predecessor-ivy", "#8c4934", "leaf");
  const f = new Form(scene,"predecessor-form");
  f.ellipsoid([0,.52,0],[.38,.45,.23],ceramic);
  f.branch([[0,.35,0],[0,.68,-.02],[0,.83,.06]],.07,metal);
  const head=f.ellipsoid([0,.92,.12],[.55,.23,.24],ceramic); head.rotation.z=-.18;
  for(const side of [-1,1]) {
    const barrel = f.ring([side*.145,.92,.23],.18,.035,metal); barrel.rotation.x=Math.PI/2;
    f.ellipsoid([side*.145,.92,.25],[.14,.14,.025],lens);
    f.ellipsoid([side*.23,.62,0],[.14,.16,.14],metal);
    f.branch([[side*.23,.6,0],[side*.3,.34,.14],[side*.27,.22,.3]],.045,metal);
    const plate=f.ellipsoid([side*.28,.43,.07],[.13,.25,.12],ceramic); plate.rotation.z=side*.2;
    f.ellipsoid([side*.27,.2,.31],[.09,.06,.1],metal);
    f.branch([[side*.1,.3,0],[side*.16,.13,.27],[side*.18,.08,.55]],.055,metal);
    f.ellipsoid([side*.15,.19,.2],[.17,.17,.3],ceramic);
    f.ellipsoid([side*.18,.1,.45],[.15,.13,.28],ceramic);
    f.box([side*.18,.045,.61],[.14,.08,.18],metal);
    const panel=f.box([side*.14,.55,-.18],[.22,.32,.025],solar); panel.rotation.z=side*.25;
    f.branch([[side*.17,.04,.07],[side*.26,.38,-.03],[side*.2,.75,.04],[side*.12,1.04,.06]],.015,ivy);
    for(let i=0;i<6;i++) {
      const leaf=f.ellipsoid([side*(.15+(i%2)*.09),.25+i*.13,.06],[.09,.035,.12],ivy,6); leaf.rotation.z=i*.8;
    }
  }
  return f.finish(node);
}

export function guardianVisual(scene: Scene, name: string, stone: StandardMaterial, openMouth: boolean): Mesh {
  const f=new Form(scene,name);
  f.ellipsoid([0,.5,0],[.68,.85,.52],stone);
  f.ellipsoid([0,.92,.1],[.65,.49,.5],stone);
  f.ellipsoid([0,.83,.34],[.4,.19,.25],stone);
  for(const side of [-1,1]) {
    f.ellipsoid([side*.2,.26,.18],[.17,.48,.2],stone);
    f.ellipsoid([side*.2,.08,.27],[.22,.15,.29],stone);
    f.ellipsoid([side*.25,1.1,.05],[.18,.2,.16],stone);
    f.ellipsoid([side*.14,.99,.32],[.12,.08,.09],stone);
    for(let i=0;i<5;i++) {
      const curl=f.ring([side*(.25+Math.sin(i)*.05),.48+i*.12,-.02],.18,.065,stone);
      curl.rotation.x=Math.PI/2;
    }
  }
  f.branch([[0,.2,-.18],[0,.45,-.45],[0,.73,-.38]],.1,stone);
  const mesh=f.finish()[0]; mesh.name=name;
  // Recessed mouth is modelled as a second stone jaw, not glowing animal eyes.
  if(openMouth) {
    const jaw=MeshBuilder.CreateSphere(`${name}:jaw`,{diameter:1,segments:6},scene);
    jaw.scaling.set(.3,.08,.2);jaw.position.set(0,.7,.36);jaw.material=stone;
    const joined=Mesh.MergeMeshes([mesh,jaw],true,true)!;joined.name=name;return joined;
  }
  return mesh;
}
