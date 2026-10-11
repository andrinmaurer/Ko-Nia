import { Color3, DynamicTexture, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, TransformNode } from "../babylon";
import { Form, organic } from "./life/visuals";
import { surface } from "./textures";

/** Fictional, eroded menu writing; deliberately avoids real-world branding. */
function menuMaterial(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("artifact:menu",scene);
  const tex = new DynamicTexture("menu-script",{width:256,height:256},scene,true);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  c.fillStyle="#9d9279";c.fillRect(0,0,256,256);
  for(let x=0;x<256;x+=32) {
    c.fillStyle="rgba(48,42,31,.25)";c.fillRect(x,0,2,256);
    c.strokeStyle="#484439";c.lineWidth=2;
    for(let y=24;y<218;y+=27) {
      c.beginPath();c.moveTo(x+9,y);c.lineTo(x+17,y+5);c.lineTo(x+11,y+16);
      c.moveTo(x+6,y+9);c.lineTo(x+23,y+8);c.moveTo(x+17,y+2);c.lineTo(x+20,y+20);c.stroke();
    }
  }
  for(let i=0;i<80;i++) {c.fillStyle="rgba(123,116,94,.2)";c.fillRect((i*73)%256,(i*47)%256,12,4);}
  tex.update(false);m.diffuseTexture=tex;m.specularColor=Color3.Black();return m;
}

export function dressArtifacts(scene: Scene, shadows: ShadowGenerator): void {
  const oldVending=scene.getMeshByName("shopVending")!;
  oldVending.isVisible=false;oldVending.isPickable=false;
  const cabinet=new TransformNode("vendingCabinet",scene);
  cabinet.position.copyFrom(oldVending.position);cabinet.rotation.z=-Math.PI/2;
  const enamel=organic(scene,"vending-enamel","#788e8b","ceramic");
  const rust=surface(scene,"rust"), dark=organic(scene,"vending-interior","#2b3635");
  const f=new Form(scene,"shopVending");
  // Box frame remains open at the front, revealing empty shelves and dispensing spirals.
  f.box([-.42,0,0],[.07,1.8,.75],enamel);f.box([.42,0,0],[.07,1.8,.75],enamel);
  f.box([0,.86,0],[.83,.08,.75],enamel);f.box([0,-.86,0],[.83,.08,.75],rust);
  f.box([0,0,-.34],[.8,1.7,.06],dark);f.box([.29,0,.36],[.2,1.7,.05],enamel);
  for(let row=0;row<4;row++) {
    const y=-.42+row*.32;
    f.box([-.1,y,0],[.58,.025,.65],rust);
    for(let col=0;col<3;col++) {
      const spiral=f.ring([-.28+col*.18,y+.11,.14],.12,.012,rust);spiral.rotation.x=Math.PI/2;
    }
  }
  f.box([-.11,-.68,.35],[.52,.15,.025],dark);
  f.box([.29,.26,.39],[.025,.12,.015],dark);f.box([.29,-.1,.39],[.1,.025,.015],dark);
  // Only edge fragments remain; there is no transparent full-size window pass.
  for(const [x,y] of [[-.33,.71],[.15,.6],[-.29,-.51]]) {
    const shard=f.ellipsoid([x,y,.36],[.14,.08,.015],enamel,4);shard.rotation.z=x*3;
  }
  for (const mesh of f.finish(cabinet)) {
    mesh.checkCollisions = true;
    shadows.addShadowCaster(mesh);
  }

  const oldMenu=scene.getMeshByName("shopMenuBoard")!;
  oldMenu.isVisible=false;oldMenu.isPickable=false;oldMenu.checkCollisions=false;
  const wood=surface(scene,"wood"), panel=new Form(scene,"shopMenuBoard");
  panel.box([0,0,0],[1.2,.9,.035],wood);
  for(const x of [-.59,.59])panel.box([x,0,-.02],[.055,.94,.07],wood);
  for(const y of [-.44,.44])panel.box([0,y,-.02],[1.2,.05,.07],wood);
  const script=MeshBuilder.CreatePlane("menuWriting",{width:1.08,height:.78},scene);
  script.position.z=-.039;script.rotation.y=Math.PI;panel.add(script,menuMaterial(scene));
  for(const mesh of panel.finish()) {
    mesh.position.copyFrom(oldMenu.position);
    shadows.addShadowCaster(mesh);
  }
}
