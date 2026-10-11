import { Color3, Scene, StandardMaterial } from "../../babylon";

/** Matte placeholder material, shared by name so repeated creatures reuse it. */
export function mat(scene: Scene, name: string, r: number, g: number, b: number, specular = 0.05): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = new Color3(r, g, b);
  m.specularColor = new Color3(specular, specular, specular);
  return m;
}
