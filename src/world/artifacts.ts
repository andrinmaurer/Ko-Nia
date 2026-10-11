import { Color3, DynamicTexture, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, TransformNode } from "../babylon";
import { Form, organic } from "./life/visuals";
import { mat } from "./life/materials";
import { card, rng, surface } from "./textures";

/** Fictional, eroded menu writing on weathered vertical planks; deliberately avoids real-world branding (Menu Board sheet). */
function menuMaterial(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("artifact:menu",scene);
  const tex = new DynamicTexture("menu-script",{width:256,height:256},scene,true);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  const r = rng(11);
  // Sun-bleached planks with grain, splits and water stains.
  for (let x = 0; x < 256; x += 43) {
    c.fillStyle = `rgb(${176 + r() * 20},${160 + r() * 18},${128 + r() * 14})`; c.fillRect(x, 0, 43, 256);
    c.fillStyle = "rgba(60,48,34,.55)"; c.fillRect(x, 0, 2, 256);
    for (let i = 0; i < 24; i++) { c.fillStyle = "rgba(90,74,52,.18)"; c.fillRect(x + r() * 43, r() * 256, 1, 20 + r() * 60); }
  }
  for (let i = 0; i < 8; i++) { c.fillStyle = "rgba(96,80,58,.22)"; c.beginPath(); c.ellipse(r() * 256, 200 + r() * 56, 20 + r() * 30, 10 + r() * 20, 0, 0, 7); c.fill(); }
  // Columns of brush-stroke glyphs, faded and partly flaked away.
  for (let col = 0; col < 6; col++) {
    const x = 224 - col * 40;
    for (let y = 22; y < 214; y += 26) {
      if (r() < .18) continue;
      c.strokeStyle = `rgba(28,24,20,${.45 + r() * .4})`; c.lineWidth = 3 + r() * 2;
      c.beginPath(); c.moveTo(x - 9, y + 2); c.lineTo(x + 9, y);
      c.moveTo(x, y - 6); c.lineTo(x - 2, y + 14);
      c.moveTo(x - 7, y + 9); c.quadraticCurveTo(x, y + 5, x + 8, y + 15); c.stroke();
    }
    // Price marks: small red seals at the foot of a column.
    if (col % 2 === 0) { c.fillStyle = "rgba(168,60,40,.75)"; c.beginPath(); c.arc(x, 232, 8, 0, 7); c.fill(); }
  }
  // Faded plant motif in the lower left corner.
  c.strokeStyle = "rgba(90,104,70,.6)"; c.lineWidth = 2;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(14 + i * 6, 250); c.quadraticCurveTo(10 + i * 9, 200, 24 + i * 7, 170); c.stroke(); }
  for (let i = 0; i < 70; i++) { c.fillStyle = "rgba(206,196,170,.6)"; c.fillRect(r() * 256, r() * 256, 2 + r() * 6, 1 + r() * 3); }
  tex.update(false);m.diffuseTexture=tex;m.specularColor=Color3.Black();return m;
}

export function dressArtifacts(scene: Scene, shadows: ShadowGenerator): void {
  const oldVending=scene.getMeshByName("shopVending")!;
  oldVending.isVisible=false;oldVending.isPickable=false;
  const cabinet=new TransformNode("vendingCabinet",scene);
  cabinet.position.copyFrom(oldVending.position);cabinet.rotation.set(0,.25,-Math.PI/2+.12);
  // Vending Machine sheet: pale blue enamel blistered with rust, a red-brown base, shattered glass,
  // empty slots with dispensing spirals, a coin panel on the right, ivy and moss in the seams.
  const enamel=organic(scene,"vending-paint","#8aa3a9","rusted");
  const trim=organic(scene,"vending-trim","#8a4a35","rusted");
  const rust=surface(scene,"rust"), dark=organic(scene,"vending-interior","#2b3332");
  const glass=mat(scene,"vendingGlass",.55,.66,.68,.9);glass.alpha=.55;
  const moss=organic(scene,"vending-moss","#4f6a2e","moss");
  const vine=card(scene,"vine");
  const f=new Form(scene,"shopVending");
  // Box frame remains open at the front, revealing empty shelves and dispensing spirals.
  f.box([-.42,0,0],[.07,1.8,.75],enamel);f.box([.42,0,0],[.07,1.8,.75],enamel);
  f.box([0,.86,0],[.83,.08,.75],enamel);f.box([0,-.84,0],[.83,.12,.75],trim);
  f.box([0,0,-.34],[.8,1.7,.06],dark);f.box([.29,0,.36],[.2,1.7,.05],enamel);
  for(let row=0;row<5;row++) {
    const y=-.5+row*.27;
    f.box([-.1,y,0],[.58,.025,.65],rust);
    for(let col=0;col<4;col++) {
      // Spiral coil: a few stacked rings along the slot depth.
      for(let k=0;k<3;k++){const spiral=f.ring([-.33+col*.15,y+.08,.22-k*.12],.09,.008,rust);spiral.rotation.x=Math.PI/2;}
    }
  }
  f.box([-.11,-.7,.36],[.52,.14,.03],dark);
  // Coin mechanism: slot, return lever and button column on the side panel.
  f.box([.29,.3,.39],[.12,.24,.02],organic(scene,"vending-coin","#6f7471"));
  f.box([.29,.34,.405],[.012,.08,.01],dark);f.box([.29,.2,.405],[.06,.02,.01],dark);
  for(let i=0;i<4;i++) f.box([.29,.02-i*.08,.4],[.05,.035,.012],dark);
  f.box([.29,-.55,.39],[.14,.12,.02],dark);
  // Jagged glass left in the frame; most of the window lies shattered.
  for(const [x,y,w,h,a] of [[-.32,.66,.14,.3,.4],[.12,.7,.2,.12,-.3],[-.3,-.46,.12,.28,.1],[.05,-.6,.18,.08,.6]] as const) {
    const shard=f.box([x,y,.37],[w,h,.008],glass);shard.rotation.z=a;
  }
  // Moss cushions in the seams and ivy trailing over the top edge.
  for(const [x,y,z] of [[.4,.82,.3],[-.4,-.8,.2],[.42,-.3,-.3],[0,.88,-.2]] as const) f.ellipsoid([x,y,z],[.22,.08,.2],moss,6);
  for(let i=0;i<3;i++) f.plane([-.3+i*.3,.4,.4],[.45,1.1],[0,0,Math.PI/2+i*.3],vine);
  for (const mesh of f.finish(cabinet)) {
    mesh.checkCollisions = !mesh.material?.name.startsWith("card:") && mesh.material !== glass;
    if (mesh.material === glass) mesh.isPickable = false;
    shadows.addShadowCaster(mesh);
  }

  const oldMenu=scene.getMeshByName("shopMenuBoard")!;
  oldMenu.isVisible=false;oldMenu.isPickable=false;oldMenu.checkCollisions=false;
  const wood=organic(scene,"menu-frame","#5a4632","bark"), iron=organic(scene,"menu-iron","#4a3426","rusted");
  const panel=new Form(scene,"shopMenuBoard");
  // Splintered dark frame with corner joints, hung from a crossbar by two rusted rings.
  panel.box([0,0,0],[1.2,.9,.035],wood);
  for(const x of [-.6,.6])panel.box([x,0,-.02],[.07,.98,.08],wood);
  for(const y of [-.46,.46])panel.box([0,y,-.02],[1.32,.07,.08],wood);
  panel.box([0,.72,-.03],[1.5,.09,.1],wood);
  for(const x of [-.42,.42]) {
    panel.box([x,.6,-.03],[.03,.16,.03],iron);
    const ring=panel.ring([x,.52,-.03],.07,.015,iron);ring.rotation.y=Math.PI/2;
  }
  const script=MeshBuilder.CreatePlane("menuWriting",{width:1.08,height:.78},scene);
  // Plane fronts face -z, out into the front room.
  script.position.z=-.039;panel.add(script,menuMaterial(scene));
  for(const mesh of panel.finish()) {
    mesh.position.copyFrom(oldMenu.position);
    shadows.addShadowCaster(mesh);
  }
}
